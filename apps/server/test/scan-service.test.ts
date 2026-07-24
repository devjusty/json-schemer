import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { extractJsonLd } from "@schemer/extractor";
import { createDatabase, createRepositories } from "@schemer/storage";
import { describe, expect, it } from "vitest";
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
          ? {
              status: "ok",
              httpStatus: 200,
              contentType: "text/html",
              body: '<script type="application/ld+json">{"@type":"Article"}</script>',
              durationMs: 2,
            }
          : { status: "http_error", httpStatus: 404, contentType: "text/html", message: "HTTP 404", durationMs: 2 },
      extract: extractJsonLd,
    });

    await manager.start({ targetUrl: "https://example.com", sitemapUrl: null, settings: DEFAULT_SCAN_SETTINGS });
    await manager.waitForIdle();

    expect(repositories.getActiveScan()).toMatchObject({ status: "completed", completed: 2, successful: 1, failed: 1 });
    expect(
      repositories
        .listPages("scan-1")
        .map((page) => page.status)
        .sort(),
    ).toEqual(["http_error", "success"]);
    expect(repositories.getSiteExportData("scan-1").pages[0].blocks).toHaveLength(1);
  });

  it("stops claiming pages after cancellation and preserves canceled status", async () => {
    const repositories = createRepositories(createDatabase(":memory:"));
    let releaseFirstPage!: () => void;
    let firstPageStarted!: () => void;
    const firstPageReady = new Promise<void>((resolve) => {
      firstPageStarted = resolve;
    });
    const firstPageRelease = new Promise<void>((resolve) => {
      releaseFirstPage = resolve;
    });
    const fetchedUrls: string[] = [];
    const manager = new ScanManager({
      repositories,
      discover: async () => ({
        urls: [
          { url: "https://example.com/a", source: "https://example.com/sitemap.xml" },
          { url: "https://example.com/b", source: "https://example.com/sitemap.xml" },
          { url: "https://example.com/c", source: "https://example.com/sitemap.xml" },
        ],
        errors: [],
      }),
      fetchPage: async (url) => {
        fetchedUrls.push(url);
        if (url.endsWith("/a")) {
          firstPageStarted();
          await firstPageRelease;
        }
        return { status: "ok", httpStatus: 200, contentType: "text/html", body: "<html></html>", durationMs: 2 };
      },
      extract: extractJsonLd,
    });

    await manager.start({
      targetUrl: "https://example.com",
      sitemapUrl: null,
      settings: { ...DEFAULT_SCAN_SETTINGS, concurrency: 1 },
    });
    await firstPageReady;
    manager.cancel("scan-1");
    releaseFirstPage();
    await manager.waitForIdle();

    expect(fetchedUrls).toEqual(["https://example.com/a"]);
    expect(repositories.getActiveScan()).toMatchObject({ status: "canceled", completed: 1 });
  });
});
