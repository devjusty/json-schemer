import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { extractJsonLd } from "@schemer/extractor";
import { createDatabase } from "@schemer/storage";
import { createRepositories } from "@schemer/storage";
import { ScanManager } from "../src/scan/scan-manager";

describe("scan manager", () => {
  it("persists each page and completes after partial failure", async () => {
    const repositories = createRepositories(createDatabase(":memory:"));
    const manager = new ScanManager({
      repositories,
      discover: async () => ({
        urls: [
          { url: "https://example.com/a", source: "https://example.com/sitemap.xml" },
          { url: "https://example.com/b", source: "https://example.com/sitemap.xml" },
        ],
        errors: [],
      }),
      fetchPage: async (url) =>
        url.endsWith("/a")
          ? { status: "ok", httpStatus: 200, contentType: "text/html", body: '<script type="application/ld+json">{"@type":"Article"}</script>', durationMs: 2 }
          : { status: "http_error", httpStatus: 404, contentType: "text/html", message: "HTTP 404", durationMs: 2 },
      extract: extractJsonLd,
    });

    await manager.start({ targetUrl: "https://example.com", sitemapUrl: null, settings: DEFAULT_SCAN_SETTINGS });
    await manager.waitForIdle();

    expect(repositories.getActiveScan()).toMatchObject({ status: "completed", completed: 2, successful: 1, failed: 1 });
    expect(repositories.listPages("scan-1").map((page) => page.status).sort()).toEqual(["http_error", "success"]);
    expect(repositories.getSiteExportData("scan-1").pages[0].blocks).toHaveLength(1);
  });
});
