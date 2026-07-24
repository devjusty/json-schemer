import { describe, expect, it } from "vitest";
import { discoverSitemaps, parseSitemapXml } from "../src/sitemap";

describe("sitemap parsing", () => {
  it("parses URL sets and sitemap indexes", () => {
    const urlSet = parseSitemapXml(
      "<urlset><url><loc>https://example.com/a</loc></url><url><loc>https://example.com/b</loc></url></urlset>",
    );
    const index = parseSitemapXml(
      "<sitemapindex><sitemap><loc>https://example.com/sitemap-1.xml</loc></sitemap></sitemapindex>",
    );

    expect(urlSet).toEqual({
      kind: "urlset",
      urls: ["https://example.com/a", "https://example.com/b"],
    });
    expect(index).toEqual({
      kind: "index",
      sitemaps: ["https://example.com/sitemap-1.xml"],
    });
  });

  it("follows sitemap references from robots and records failures", async () => {
    const responses = new Map([
      ["https://example.com/robots.txt", "Sitemap: https://example.com/sitemap.xml"],
      [
        "https://example.com/sitemap.xml",
        "<urlset><url><loc>https://example.com/a</loc></url></urlset>",
      ],
    ]);
    const result = await discoverSitemaps(new URL("https://example.com"), async (url) => {
      const value = responses.get(url.href);
      if (!value) throw new Error("not found");
      return value;
    });

    expect(result.urls).toEqual([{ url: "https://example.com/a", source: "https://example.com/sitemap.xml" }]);
    expect(result.errors).toEqual([
      { source: "https://example.com/sitemap_index.xml", message: "not found" },
    ]);
  });

  it("rejects malformed XML", () => {
    expect(() => parseSitemapXml("<urlset><url>")).toThrow(/sitemap/i);
  });
});
