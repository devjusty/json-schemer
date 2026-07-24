import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { extractJsonLd } from "@schemer/extractor";
import { createDatabase, createRepositories } from "@schemer/storage";
import { describe, expect, it } from "vitest";
import { PageProcessor } from "../src/scan/page-processor";

const settings = DEFAULT_SCAN_SETTINGS;

function createProcessor(overrides: Partial<ConstructorParameters<typeof PageProcessor>[0]> = {}) {
  const repositories = createRepositories(createDatabase(":memory:"));
  repositories.replaceActiveScan({
    id: "scan-1",
    targetUrl: "https://example.com/",
    sitemapUrl: null,
    settings,
  });
  return {
    repositories,
    processor: new PageProcessor({
      repositories,
      fetchPage: async () => ({
        status: "ok",
        httpStatus: 200,
        contentType: "text/html",
        body: "<html></html>",
        durationMs: 3,
      }),
      extract: extractJsonLd,
      createId: (() => {
        let next = 0;
        return () => `id-${++next}`;
      })(),
      ...overrides,
    }),
  };
}

describe("PageProcessor", () => {
  it("persists valid JSON-LD blocks and their entities", async () => {
    const { processor, repositories } = createProcessor({
      fetchPage: async () => ({
        status: "ok",
        httpStatus: 200,
        contentType: "text/html",
        body: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',
        durationMs: 3,
      }),
    });

    const result = await processor.process("scan-1", "https://example.com/a", "sitemap.xml", settings);
    const page = repositories.listPages("scan-1")[0];
    const detail = repositories.getPageDetail("scan-1", page.id);

    expect(result).toEqual({ status: "success", successful: true });
    expect(detail.page).toMatchObject({ status: "success", sitemapSource: "sitemap.xml" });
    expect(detail.blocks).toHaveLength(1);
    expect(detail.blocks[0]).toMatchObject({ id: "id-2", pageId: page.id, ordinal: 0 });
    expect(detail.entities).toMatchObject([{ id: "id-3", blockId: "id-2", types: ["Article"] }]);
  });

  it("rolls back page and blocks when entity persistence fails", async () => {
    const { processor, repositories } = createProcessor({
      fetchPage: async () => ({
        status: "ok",
        httpStatus: 200,
        contentType: "text/html",
        body: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',
        durationMs: 3,
      }),
      createId: (() => {
        const ids = ["new-page", "new-block", "existing-entity"];
        return () => ids.shift() ?? "unexpected-id";
      })(),
    });
    const seedPage = repositories.upsertPage({
      id: "seed-page",
      scanId: "scan-1",
      url: "https://example.com/seed",
      normalizedUrl: "https://example.com/seed",
      sitemapSource: null,
      status: "success",
      httpStatus: 200,
      contentType: "text/html",
      durationMs: 1,
      error: null,
    });
    repositories.insertJsonLdBlock({
      id: "seed-block",
      pageId: seedPage.id,
      ordinal: 0,
      rawText: "seed",
      parsed: null,
      parseError: null,
    });
    repositories.insertSchemaEntity({
      id: "existing-entity",
      blockId: "seed-block",
      context: null,
      types: ["Article"],
      serialized: "seed",
    });

    await expect(processor.process("scan-1", "https://example.com/a", null, settings)).rejects.toThrow();

    expect(repositories.listPages("scan-1").map((page) => page.id)).toEqual(["seed-page"]);
    expect(repositories.getPageDetail("scan-1", "seed-page")).toMatchObject({
      blocks: [{ id: "seed-block" }],
      entities: [{ id: "existing-entity", blockId: "seed-block" }],
    });
  });

  it("persists no_jsonld when page has no JSON-LD", async () => {
    const { processor, repositories } = createProcessor();

    const result = await processor.process("scan-1", "https://example.com/a", null, settings);

    expect(result).toEqual({ status: "no_jsonld", successful: false });
    expect(repositories.listPages("scan-1")[0]).toMatchObject({ status: "no_jsonld", error: null });
  });

  it("persists invalid_jsonld and malformed block details", async () => {
    const { processor, repositories } = createProcessor({
      fetchPage: async () => ({
        status: "ok",
        httpStatus: 200,
        contentType: "text/html",
        body: '<script type="application/ld+json">{"@type":</script>',
        durationMs: 3,
      }),
    });

    const result = await processor.process("scan-1", "https://example.com/a", null, settings);
    const page = repositories.listPages("scan-1")[0];

    expect(result).toEqual({ status: "invalid_jsonld", successful: false });
    expect(repositories.getPageDetail("scan-1", page.id).blocks[0]).toMatchObject({
      parsed: null,
      parseError: expect.stringContaining("JSON-LD parse error"),
    });
  });

  it("persists parse_error when extraction fails", async () => {
    const { processor, repositories } = createProcessor({
      extract: () => {
        throw new Error("extract failed");
      },
    });

    const result = await processor.process("scan-1", "https://example.com/a", null, settings);

    expect(result).toEqual({ status: "parse_error", successful: false });
    expect(repositories.listPages("scan-1")[0]).toMatchObject({ status: "parse_error", error: "extract failed" });
  });

  it("persists HTTP failures without extracting", async () => {
    let extracted = false;
    const { processor, repositories } = createProcessor({
      fetchPage: async () => ({
        status: "http_error",
        httpStatus: 404,
        contentType: "text/html",
        message: "HTTP 404",
        durationMs: 3,
      }),
      extract: () => {
        extracted = true;
        return { blocks: [], hasValidBlock: false };
      },
    });

    const result = await processor.process("scan-1", "https://example.com/a", null, settings);

    expect(result).toEqual({ status: "http_error", successful: false });
    expect(extracted).toBe(false);
    expect(repositories.listPages("scan-1")[0]).toMatchObject({
      status: "http_error",
      httpStatus: 404,
      error: "HTTP 404",
    });
  });

  it("maps non-HTTP fetch failures to fetch_error", async () => {
    const { processor, repositories } = createProcessor({
      fetchPage: async () => ({
        status: "fetch_error",
        httpStatus: null,
        contentType: null,
        message: "network failed",
        durationMs: 3,
      }),
    });

    const result = await processor.process("scan-1", "https://example.com/a", null, settings);

    expect(result).toEqual({ status: "fetch_error", successful: false });
    expect(repositories.listPages("scan-1")[0]).toMatchObject({ status: "fetch_error", error: "network failed" });
  });
});
