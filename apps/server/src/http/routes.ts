import { assertAllowedTarget } from "@schemer/crawler";
import { DEFAULT_SCAN_SETTINGS, type ExportFormat } from "@schemer/domain";
import {
  contentDispositionAttachment,
  exportBasename,
  serializeCsv,
  serializeJson,
  serializeMarkdown,
} from "@schemer/exporters";
import type { Repositories } from "@schemer/storage";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { ScanInput, ScanManager } from "../scan/scan-manager";

interface AppDependencies {
  repositories: Repositories;
  manager: ScanManager;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseSettings(value: unknown) {
  if (!value || typeof value !== "object") return DEFAULT_SCAN_SETTINGS;
  const candidate = value as Record<string, unknown>;
  const numeric = (key: keyof typeof DEFAULT_SCAN_SETTINGS, min: number, max: number): number => {
    const raw = candidate[key];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < min || raw > max)
      return DEFAULT_SCAN_SETTINGS[key] as number;
    return Math.round(raw);
  };
  return {
    maxUrls: numeric("maxUrls", 1, 500),
    concurrency: numeric("concurrency", 1, 16),
    delayMs: numeric("delayMs", 0, 60_000),
    timeoutMs: numeric("timeoutMs", 1_000, 120_000),
    maxResponseBytes: numeric("maxResponseBytes", 1_000, 50_000_000),
    maxRedirects: numeric("maxRedirects", 0, 10),
    respectRobots: candidate.respectRobots !== false,
    sameOriginOnly: candidate.sameOriginOnly !== false,
  };
}

function formatContentType(format: ExportFormat): string {
  const base =
    format === "json" ? "application/json" : format === "markdown" ? "text/markdown" : "text/csv";
  return `${base}; charset=utf-8`;
}

function formatExport(format: ExportFormat, data: Parameters<typeof serializeJson>[0]): string {
  if (format === "json") return serializeJson(data);
  if (format === "markdown") return serializeMarkdown(data);
  return serializeCsv(data);
}

function isTerminalScan(status: string): boolean {
  return ["completed", "canceled", "failed"].includes(status);
}

function isNotFoundError(error: unknown): boolean {
  const message = errorMessage(error);
  return message.startsWith("Scan not found:") || message.startsWith("Page not found:");
}

function sendExport(
  reply: FastifyReply,
  format: ExportFormat,
  data: Parameters<typeof serializeJson>[0],
  basename: string,
) {
  if (!isTerminalScan(data.scan.status)) return reply.code(409).send({ error: "Scan is still active" });
  const body = formatExport(format, data);
  return reply
    .header("content-type", formatContentType(format))
    .header("content-disposition", contentDispositionAttachment(basename, format))
    .send(body);
}

function handleExport(
  reply: FastifyReply,
  rawFormat: string,
  loadData: (format: ExportFormat) => Parameters<typeof serializeJson>[0],
  basenameFor: (data: Parameters<typeof serializeJson>[0]) => string,
) {
  if (!["json", "markdown", "csv"].includes(rawFormat))
    return reply.code(400).send({ error: "Unsupported export format" });
  try {
    const format = rawFormat as ExportFormat;
    const data = loadData(format);
    return sendExport(reply, format, data, basenameFor(data));
  } catch (error) {
    return reply.code(isNotFoundError(error) ? 404 : 500).send({ error: errorMessage(error) });
  }
}

export async function createApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.post<{ Body: Record<string, unknown> }>("/api/scans", async (request, reply) => {
    const rawTarget = request.body?.targetUrl;
    if (typeof rawTarget !== "string") return reply.code(400).send({ error: "Target URL must be valid HTTP(S)" });
    let target: URL;
    try {
      target = assertAllowedTarget(rawTarget);
    } catch {
      return reply.code(400).send({ error: "Target URL must be valid HTTP(S)" });
    }

    const rawSitemap = request.body?.sitemapUrl;
    let sitemapUrl: string | null = null;
    if (rawSitemap != null) {
      if (typeof rawSitemap !== "string") return reply.code(400).send({ error: "Sitemap URL must be valid HTTP(S)" });
      try {
        sitemapUrl = assertAllowedTarget(rawSitemap).href;
      } catch {
        return reply.code(400).send({ error: "Sitemap URL must be valid HTTP(S)" });
      }
    }

    const input: ScanInput = { targetUrl: target.href, sitemapUrl, settings: parseSettings(request.body?.settings) };
    const scan = await dependencies.manager.start(input);
    return reply.code(202).send(scan);
  });

  app.get("/api/scans/active", async (_request, reply) => reply.send(dependencies.repositories.getActiveScan()));

  app.post<{ Params: { scanId: string } }>("/api/scans/:scanId/cancel", async (request, reply) => {
    if (!dependencies.manager.get(request.params.scanId)) return reply.code(404).send({ error: "Scan not found" });
    dependencies.manager.cancel(request.params.scanId);
    return reply.send(dependencies.repositories.getActiveScan());
  });

  app.get<{ Params: { scanId: string }; Querystring: { status?: string } }>(
    "/api/scans/:scanId/pages",
    async (request, reply) => {
      if (!dependencies.manager.get(request.params.scanId)) return reply.code(404).send({ error: "Scan not found" });
      return reply.send(
        dependencies.repositories.listPages(
          request.params.scanId,
          request.query.status ? { status: request.query.status as never } : {},
        ),
      );
    },
  );

  app.get<{ Params: { scanId: string; pageId: string } }>(
    "/api/scans/:scanId/pages/:pageId",
    async (request, reply) => {
      try {
        return reply.send(dependencies.repositories.getPageDetail(request.params.scanId, request.params.pageId));
      } catch (error) {
        return reply.code(404).send({ error: errorMessage(error) });
      }
    },
  );

  app.get<{ Params: { scanId: string } }>("/api/scans/:scanId/events", async (request, reply) => {
    if (!dependencies.manager.get(request.params.scanId)) return reply.code(404).send({ error: "Scan not found" });
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (event: unknown) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    const unsubscribe = dependencies.manager.subscribe(request.params.scanId, send);
    request.raw.on("close", unsubscribe);
    send({
      type: "scan_state",
      progress: dependencies.manager.currentProgress(request.params.scanId),
    });
  });

  app.get<{ Params: { scanId: string; format: string } }>(
    "/api/scans/:scanId/export/:format",
    async (request, reply) => {
      return handleExport(
        reply,
        request.params.format,
        () => dependencies.repositories.getSiteExportData(request.params.scanId),
        (data) => exportBasename(data.scan.targetUrl, "site"),
      );
    },
  );

  app.get<{ Params: { scanId: string; pageId: string; format: string } }>(
    "/api/scans/:scanId/pages/:pageId/export/:format",
    async (request, reply) => {
      return handleExport(
        reply,
        request.params.format,
        () => dependencies.repositories.getPageExportData(request.params.scanId, request.params.pageId),
        (data) =>
          exportBasename(
            data.scan.targetUrl,
            "page",
            "page" in data ? data.page.url : data.pages[0]?.page.url,
          ),
      );
    },
  );

  app.setErrorHandler((error, _request, reply) =>
    reply.code(500).send({ error: error instanceof Error ? error.message : String(error) }),
  );
  return app;
}
