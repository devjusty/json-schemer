import { randomUUID } from "node:crypto";
import type { FetchResult } from "@schemer/crawler";
import { filterSitemapUrls } from "@schemer/crawler";
import type { ScanSettings, ScanProgress } from "@schemer/domain";
import type { JsonLdExtractionResult } from "@schemer/extractor";
import type { Repositories } from "@schemer/storage";

export interface DiscoveredUrl {
  url: string;
  source: string;
}

export interface ScanInput {
  targetUrl: string;
  sitemapUrl: string | null;
  settings: ScanSettings;
}

export interface DiscoveryResult {
  urls: DiscoveredUrl[];
  errors: Array<{ source: string; message: string }>;
}

export interface ScanDependencies {
  repositories: Repositories;
  discover: (target: URL, sitemapUrl: string | null) => Promise<DiscoveryResult>;
  fetchPage: (url: string, settings: ScanSettings) => Promise<FetchResult>;
  extract: (html: string) => JsonLdExtractionResult;
}

export type ScanEvent =
  | { type: "scan_state"; progress: ScanProgress }
  | { type: "progress"; progress: ScanProgress }
  | { type: "page_completed"; progress: ScanProgress }
  | { type: "scan_completed"; progress: ScanProgress }
  | { type: "scan_error"; progress: ScanProgress; message: string };

type Listener = (event: ScanEvent) => void;

function statusFor(result: FetchResult): "http_error" | "fetch_error" {
  if (result.status === "http_error") return "http_error";
  return "fetch_error";
}

export class ScanManager {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly activeRuns = new Map<string, Promise<void>>();
  private sequence = 0;

  constructor(private readonly dependencies: ScanDependencies) {}

  async start(input: ScanInput) {
    const scanId = `scan-${++this.sequence}`;
    const target = new URL(input.targetUrl);
    const scan = this.dependencies.repositories.replaceActiveScan({
      id: scanId,
      targetUrl: target.href,
      sitemapUrl: input.sitemapUrl,
      settings: input.settings,
    });
    const run = this.run(scanId, target, input);
    this.activeRuns.set(scanId, run);
    void run.finally(() => this.activeRuns.delete(scanId));
    return scan;
  }

  get(scanId: string) {
    const scan = this.dependencies.repositories.getActiveScan();
    return scan?.id === scanId ? scan : null;
  }

  cancel(scanId: string): void {
    this.dependencies.repositories.updateScanProgress(scanId, {
      status: "canceled",
      ...this.currentProgress(scanId),
    });
  }

  subscribe(scanId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(scanId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(scanId, listeners);
    return () => listeners.delete(listener);
  }

  async waitForIdle(): Promise<void> {
    await Promise.all(this.activeRuns.values());
  }

  private currentProgress(scanId: string): ScanProgress {
    const scan = this.dependencies.repositories.getActiveScan();
    if (!scan || scan.id !== scanId) throw new Error(`Scan not found: ${scanId}`);
    return {
      scanId,
      discovered: scan.discovered,
      queued: scan.queued,
      completed: scan.completed,
      successful: scan.successful,
      failed: scan.failed,
    };
  }

  private publish(scanId: string, event: ScanEvent["type"], message?: string): void {
    const progress = this.currentProgress(scanId);
    const payload = message ? { type: event, progress, message } : { type: event, progress };
    for (const listener of this.listeners.get(scanId) ?? []) listener(payload as ScanEvent);
  }

  private async run(scanId: string, target: URL, input: ScanInput): Promise<void> {
    try {
      this.dependencies.repositories.updateScanProgress(scanId, {
        status: "discovering",
        ...this.currentProgress(scanId),
      });
      this.publish(scanId, "scan_state");
      const discovery = await this.dependencies.discover(target, input.sitemapUrl);
      const urls = filterSitemapUrls(
        discovery.urls.map((entry) => entry.url),
        target,
        input.settings.maxUrls,
      );
      const sourceByUrl = new Map(discovery.urls.map((entry) => [entry.url, entry.source]));
      this.dependencies.repositories.updateScanProgress(scanId, {
        status: "crawling",
        ...this.currentProgress(scanId),
        discovered: urls.length,
        queued: urls.length,
      });
      this.publish(scanId, "progress");

      let nextIndex = 0;
      const worker = async (): Promise<void> => {
        while (nextIndex < urls.length) {
          const index = nextIndex++;
          const url = urls[index];
          await this.processPage(scanId, url, sourceByUrl.get(url) ?? null, input.settings);
        }
      };
      await Promise.all(Array.from({ length: Math.min(input.settings.concurrency, urls.length || 1) }, worker));

      const progress = this.currentProgress(scanId);
      this.dependencies.repositories.updateScanProgress(scanId, {
        status: "completed",
        ...progress,
      });
      this.publish(scanId, "scan_completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.dependencies.repositories.updateScanProgress(scanId, {
        status: "failed",
        ...this.currentProgress(scanId),
        error: message,
      });
      this.publish(scanId, "scan_error", message);
    }
  }

  private async processPage(scanId: string, url: string, sitemapSource: string | null, settings: ScanSettings): Promise<void> {
    const result = await this.dependencies.fetchPage(url, settings);
    let status: "success" | "no_jsonld" | "invalid_jsonld" | "http_error" | "parse_error" | "fetch_error";
    let extraction: JsonLdExtractionResult | null = null;
    let error: string | null = null;
    if (result.status === "ok") {
      try {
        extraction = this.dependencies.extract(result.body);
        status = extraction.blocks.length === 0 ? "no_jsonld" : extraction.hasValidBlock ? "success" : "invalid_jsonld";
      } catch (cause) {
        status = "parse_error";
        error = cause instanceof Error ? cause.message : String(cause);
      }
    } else {
      status = statusFor(result);
      error = result.message;
    }

    const page = this.dependencies.repositories.upsertPage({
      id: randomUUID(),
      scanId,
      url,
      normalizedUrl: url,
      sitemapSource,
      status,
      httpStatus: result.httpStatus,
      contentType: result.contentType,
      durationMs: result.durationMs,
      error,
    });
    if (extraction) {
      for (const block of extraction.blocks) {
        const blockId = randomUUID();
        this.dependencies.repositories.insertJsonLdBlock({
          id: blockId,
          pageId: page.id,
          ordinal: block.ordinal,
          rawText: block.rawText,
          parsed: block.parsed,
          parseError: block.parseError,
        });
        for (const entity of block.entities) {
          this.dependencies.repositories.insertSchemaEntity({
            id: randomUUID(),
            blockId,
            context: entity.context,
            types: entity.types,
            serialized: entity.serialized,
          });
        }
      }
    }
    const progress = this.currentProgress(scanId);
    this.dependencies.repositories.updateScanProgress(scanId, {
      status: "crawling",
      ...progress,
      completed: progress.completed + 1,
      successful: progress.successful + (status === "success" ? 1 : 0),
      failed: progress.failed + (status === "success" || status === "no_jsonld" ? 0 : 1),
    });
    this.publish(scanId, "page_completed");
  }
}
