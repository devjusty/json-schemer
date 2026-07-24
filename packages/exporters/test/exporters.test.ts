import type { PageExportData, SiteExportData } from "@schemer/storage";
import { describe, expect, it } from "vitest";
import { serializeCsv } from "../src/csv";
import { serializeJson } from "../src/json";
import { serializeMarkdown } from "../src/markdown";

const page = {
  page: {
    id: "page-1",
    scanId: "scan-1",
    url: "https://example.com/a?x=1,2",
    normalizedUrl: "https://example.com/a",
    sitemapSource: null,
    status: "success" as const,
    httpStatus: 200,
    contentType: "text/html",
    durationMs: 10,
    error: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  blocks: [
    {
      id: "block-1",
      pageId: "page-1",
      ordinal: 0,
      rawText: '{"@type":"Article","headline":"A | headline"}',
      parsed: { "@type": "Article", headline: "A | headline" },
      parseError: null,
    },
    {
      id: "block-2",
      pageId: "page-1",
      ordinal: 1,
      rawText: '{"@type":"Broken"}',
      parsed: null,
      parseError: "JSON-LD parse error: unexpected end",
    },
  ],
  entities: [
    {
      id: "entity-1",
      blockId: "block-1",
      context: "https://schema.org",
      types: ["Article"],
      serialized: '{"@type":"Article","headline":"A | headline"}',
    },
  ],
};

const site: SiteExportData = {
  scan: {
    id: "scan-1",
    targetUrl: "https://example.com",
    sitemapUrl: "https://example.com/sitemap.xml",
    settings: {
      maxUrls: 500,
      concurrency: 4,
      delayMs: 250,
      timeoutMs: 15_000,
      maxResponseBytes: 5_000_000,
      maxRedirects: 5,
      respectRobots: true,
      sameOriginOnly: true,
    },
    status: "completed",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:02.000Z",
    discovered: 1,
    queued: 1,
    completed: 1,
    successful: 1,
    failed: 0,
    error: null,
  },
  pages: [{ ...page, page: { ...page.page, url: "https://example.com/a?x=1,2" } }],
};

const pageExport: PageExportData = { scan: site.scan, ...page };

describe("exporters", () => {
  it("serializes stable JSON for site and page scopes", () => {
    expect(JSON.parse(serializeJson(site))).toMatchObject({
      formatVersion: 1,
      scan: { id: "scan-1" },
      pages: [{ page: { id: "page-1" } }],
    });
    expect(JSON.parse(serializeJson(pageExport)).pages).toHaveLength(1);
  });

  it("renders Markdown with escaped cells and fenced raw JSON-LD", () => {
    const output = serializeMarkdown(site);
    expect(output).toContain("# Sitemap Schema Scan");
    expect(output).toContain("A | headline");
    expect(output).toContain("```json");
    expect(output).toContain("JSON-LD parse error");
    expect(output).not.toContain("<script");
  });

  it("quotes CSV values and emits one row per entity or raw block", () => {
    const rows = serializeCsv(site).trim().split("\n");
    expect(rows[0]).toBe("page_url,block_index,context,type,parse_status,serialized_json");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('"https://example.com/a?x=1,2"');
    expect(rows[2]).toContain("invalid");
  });
});
