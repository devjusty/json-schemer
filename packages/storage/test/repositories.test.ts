import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/database";
import { createRepositories } from "../src/repositories";

describe("scan repositories", () => {
  it("replaces active scan and persists page blocks transactionally", () => {
    const db = createDatabase(":memory:");
    const repositories = createRepositories(db);
    const scan = repositories.replaceActiveScan({
      id: "scan-1",
      targetUrl: "https://example.com",
      sitemapUrl: "https://example.com/sitemap.xml",
      settings: DEFAULT_SCAN_SETTINGS,
    });

    repositories.updateScanProgress(scan.id, {
      status: "crawling",
      discovered: 1,
      queued: 1,
      completed: 0,
      successful: 0,
      failed: 0,
    });
    const page = repositories.upsertPage({
      id: "page-1",
      scanId: scan.id,
      url: "https://example.com",
      normalizedUrl: "https://example.com/",
      sitemapSource: "https://example.com/sitemap.xml",
      status: "success",
      httpStatus: 200,
      contentType: "text/html",
      durationMs: 12,
      error: null,
    });
    repositories.insertJsonLdBlock({
      id: "block-1",
      pageId: page.id,
      ordinal: 0,
      rawText: '{"@type":"Article"}',
      parsed: { "@type": "Article" },
      parseError: null,
    });
    repositories.insertSchemaEntity({
      id: "entity-1",
      blockId: "block-1",
      context: "https://schema.org",
      types: ["Article"],
      serialized: '{"@type":"Article"}',
    });

    expect(repositories.getActiveScan()).toMatchObject({ id: "scan-1", status: "crawling" });
    expect(repositories.listPages("scan-1", {})).toHaveLength(1);
    expect(repositories.getPageDetail("scan-1", "page-1")).toMatchObject({
      page: { normalizedUrl: "https://example.com/" },
      blocks: [{ ordinal: 0, parseError: null }],
      entities: [{ types: ["Article"] }],
    });

    repositories.replaceActiveScan({
      id: "scan-2",
      targetUrl: "https://other.example",
      sitemapUrl: null,
      settings: DEFAULT_SCAN_SETTINGS,
    });
    expect(repositories.getActiveScan()?.id).toBe("scan-2");
    expect(repositories.listPages("scan-1", {})).toEqual([]);
  });

  it("returns complete export data", () => {
    const db = createDatabase(":memory:");
    const repositories = createRepositories(db);
    repositories.replaceActiveScan({
      id: "scan-1",
      targetUrl: "https://example.com",
      sitemapUrl: null,
      settings: DEFAULT_SCAN_SETTINGS,
    });
    repositories.persistPage({
      page: {
        id: "page-1",
        scanId: "scan-1",
        url: "https://example.com/a",
        normalizedUrl: "https://example.com/a",
        sitemapSource: null,
        status: "success",
        httpStatus: 200,
        contentType: "text/html",
        durationMs: 4,
        error: null,
      },
      blocks: [
        {
          id: "block-1",
          pageId: "page-1",
          ordinal: 0,
          rawText: '{"@type":"Article"}',
          parsed: { "@type": "Article" },
          parseError: null,
        },
      ],
      entities: [
        {
          id: "entity-1",
          blockId: "block-1",
          context: "https://schema.org",
          types: ["Article"],
          serialized: '{"@type":"Article"}',
        },
      ],
    });
    repositories.upsertPage({
      id: "page-2",
      scanId: "scan-1",
      url: "https://example.com/b",
      normalizedUrl: "https://example.com/b",
      sitemapSource: null,
      status: "no_jsonld",
      httpStatus: 200,
      contentType: "text/html",
      durationMs: 3,
      error: null,
    });

    const site = repositories.getSiteExportData("scan-1");
    expect(site.pages).toHaveLength(2);
    expect(site.pages[0]).toMatchObject({
      page: { id: "page-1", url: "https://example.com/a" },
      blocks: [{ id: "block-1", ordinal: 0 }],
      entities: [{ id: "entity-1", types: ["Article"] }],
    });
    expect(site.pages[1]).toMatchObject({
      page: { id: "page-2", status: "no_jsonld" },
      blocks: [],
      entities: [],
    });
    expect(repositories.getPageExportData("scan-1", "page-1").page.id).toBe("page-1");
  });

  it("attaches normalized URL conflicts to persisted page and replaces children", () => {
    const db = createDatabase(":memory:");
    const repositories = createRepositories(db);
    repositories.replaceActiveScan({
      id: "scan-1",
      targetUrl: "https://example.com",
      sitemapUrl: null,
      settings: DEFAULT_SCAN_SETTINGS,
    });

    repositories.persistPage({
      page: {
        id: "page-1",
        scanId: "scan-1",
        url: "https://example.com/a",
        normalizedUrl: "https://example.com/a/",
        sitemapSource: null,
        status: "success",
        httpStatus: 200,
        contentType: "text/html",
        durationMs: 1,
        error: null,
      },
      blocks: [
        {
          id: "block-1",
          pageId: "page-1",
          ordinal: 0,
          rawText: "old",
          parsed: null,
          parseError: null,
        },
      ],
      entities: [],
    });

    const persisted = repositories.persistPage({
      page: {
        id: "page-2",
        scanId: "scan-1",
        url: "https://example.com/a?ref=current",
        normalizedUrl: "https://example.com/a/",
        sitemapSource: null,
        status: "success",
        httpStatus: 200,
        contentType: "text/html",
        durationMs: 2,
        error: null,
      },
      blocks: [
        {
          id: "block-2",
          pageId: "page-2",
          ordinal: 0,
          rawText: "current",
          parsed: { "@type": "Article" },
          parseError: null,
        },
      ],
      entities: [
        {
          id: "entity-2",
          blockId: "block-2",
          context: "https://schema.org",
          types: ["Article"],
          serialized: '{"@type":"Article"}',
        },
      ],
    });

    expect(persisted.id).toBe("page-1");
    expect(repositories.listPages("scan-1")).toHaveLength(1);
    expect(repositories.getPageDetail("scan-1", "page-1")).toMatchObject({
      blocks: [{ id: "block-2", pageId: "page-1", rawText: "current" }],
      entities: [{ id: "entity-2", blockId: "block-2" }],
    });
  });

  it("rejects child relationships outside current page snapshot", () => {
    const db = createDatabase(":memory:");
    const repositories = createRepositories(db);
    repositories.replaceActiveScan({
      id: "scan-1",
      targetUrl: "https://example.com",
      sitemapUrl: null,
      settings: DEFAULT_SCAN_SETTINGS,
    });

    expect(() =>
      repositories.persistPage({
        page: {
          id: "page-1",
          scanId: "scan-1",
          url: "https://example.com/a",
          normalizedUrl: "https://example.com/a",
          sitemapSource: null,
          status: "success",
          httpStatus: 200,
          contentType: "text/html",
          durationMs: 1,
          error: null,
        },
        blocks: [],
        entities: [
          {
            id: "entity-1",
            blockId: "foreign-block",
            context: null,
            types: [],
            serialized: "{}",
          },
        ],
      }),
    ).toThrow("Entity does not belong to page snapshot");
    expect(repositories.listPages("scan-1")).toEqual([]);
  });
});
