import { describe, expect, it } from "vitest";
import { discoverSitemaps, parseSitemapXml } from "../src/sitemap";
import { discoverSitemapSources } from "../src/sitemap-discovery";

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
      ["https://example.com/sitemap.xml", "<urlset><url><loc>https://example.com/a</loc></url></urlset>"],
    ]);
    const result = await discoverSitemaps(new URL("https://example.com"), async (url) => {
      const value = responses.get(url.href);
      if (!value) throw new Error("not found");
      return value;
    });

    expect(result.urls).toEqual([{ url: "https://example.com/a", source: "https://example.com/sitemap.xml" }]);
    expect(result.errors).toEqual([{ source: "https://example.com/sitemap_index.xml", message: "not found" }]);
  });

  it("discovers the default sitemap when robots has no sitemap declarations", async () => {
    const fetched: string[] = [];
    const result = await discoverSitemaps(new URL("https://example.com"), async (url) => {
      fetched.push(url.pathname);
      if (url.pathname === "/robots.txt") return "User-agent: *\nDisallow: /private";
      if (url.pathname === "/sitemap.xml") {
        return "<urlset><url><loc>https://example.com/a</loc></url></urlset>";
      }
      if (url.pathname === "/sitemap_index.xml") {
        return "<sitemapindex><sitemap><loc>https://example.com/sitemap.xml</loc></sitemap></sitemapindex>";
      }
      throw new Error(`unexpected request: ${url.href}`);
    });

    expect(fetched).toEqual(["/robots.txt", "/sitemap.xml", "/sitemap_index.xml"]);
    expect(result.urls).toEqual([{ url: "https://example.com/a", source: "https://example.com/sitemap.xml" }]);
    expect(result.errors).toEqual([]);
  });

  it("discovers URLs from direct sitemap sources", async () => {
    const result = await discoverSitemapSources(["https://example.com/direct.xml"], async (url) => {
      expect(url.href).toBe("https://example.com/direct.xml");
      return "<urlset><url><loc>https://example.com/a</loc></url></urlset>";
    });

    expect(result).toEqual({
      urls: [{ url: "https://example.com/a", source: "https://example.com/direct.xml" }],
      errors: [],
    });
  });

  it("rejects private sitemap sources before fetching", async () => {
    const fetched: string[] = [];
    const result = await discoverSitemapSources(["http://127.0.0.1/private.xml"], async (url) => {
      fetched.push(url.href);
      return "";
    });

    expect(fetched).toEqual([]);
    expect(result).toEqual({
      urls: [],
      errors: [{ source: "http://127.0.0.1/private.xml", message: "Target must not resolve to a private network" }],
    });
  });

  it("records one error for repeated equivalent private sources", async () => {
    const result = await discoverSitemapSources(
      ["http://127.0.0.1/private.xml#first", "http://127.0.0.1:80/private.xml#second"],
      async () => {
        throw new Error("must not fetch private source");
      },
    );

    expect(result.errors).toHaveLength(1);
  });

  it("traverses nested indexes and cycles without revisiting sources", async () => {
    const responses = new Map([
      [
        "https://example.com/one.xml",
        "<sitemapindex><sitemap><loc>https://example.com/two.xml</loc></sitemap></sitemapindex>",
      ],
      [
        "https://example.com/two.xml",
        "<sitemapindex><sitemap><loc>https://example.com/one.xml</loc></sitemap><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>",
      ],
      ["https://example.com/pages.xml", "<urlset><url><loc>https://example.com/page</loc></url></urlset>"],
    ]);
    const fetched: string[] = [];
    const result = await discoverSitemapSources(["https://example.com/one.xml"], async (url) => {
      fetched.push(url.href);
      return responses.get(url.href) ?? "";
    });

    expect(fetched).toEqual([
      "https://example.com/one.xml",
      "https://example.com/two.xml",
      "https://example.com/pages.xml",
    ]);
    expect(result.urls).toEqual([{ url: "https://example.com/page", source: "https://example.com/pages.xml" }]);
  });

  it("deduplicates initial and nested sources while preserving first traversal order", async () => {
    const responses = new Map([
      [
        "https://example.com/index.xml",
        "<sitemapindex><sitemap><loc>https://example.com/pages.xml</loc></sitemap></sitemapindex>",
      ],
      ["https://example.com/pages.xml", "<urlset><url><loc>https://example.com/page</loc></url></urlset>"],
    ]);
    const fetched: string[] = [];
    const result = await discoverSitemapSources(
      ["https://example.com/pages.xml", "https://example.com/index.xml", "https://example.com/pages.xml"],
      async (url) => {
        fetched.push(url.href);
        return responses.get(url.href) ?? "";
      },
    );

    expect(fetched).toEqual(["https://example.com/pages.xml", "https://example.com/index.xml"]);
    expect(result.urls).toEqual([{ url: "https://example.com/page", source: "https://example.com/pages.xml" }]);
  });

  it("deduplicates equivalent source URLs while preserving first source string", async () => {
    const fetched: string[] = [];
    const result = await discoverSitemapSources(
      ["HTTPS://EXAMPLE.COM:443/./pages.xml#first", "https://example.com/pages.xml#second"],
      async (url) => {
        fetched.push(url.href);
        return "<urlset><url><loc>https://example.com/page</loc></url></urlset>";
      },
    );

    expect(fetched).toEqual(["https://example.com/pages.xml"]);
    expect(result.urls).toEqual([
      { url: "https://example.com/page", source: "HTTPS://EXAMPLE.COM:443/./pages.xml#first" },
    ]);
  });

  it("records errors per source and continues traversal", async () => {
    const result = await discoverSitemapSources(
      ["https://example.com/missing.xml", "https://example.com/pages.xml"],
      async (url) => {
        if (url.pathname === "/missing.xml") throw new Error("not found");
        return "<urlset><url><loc>https://example.com/page</loc></url></urlset>";
      },
    );

    expect(result).toEqual({
      urls: [{ url: "https://example.com/page", source: "https://example.com/pages.xml" }],
      errors: [{ source: "https://example.com/missing.xml", message: "not found" }],
    });
  });

  it("records empty sources as errors and continues traversal", async () => {
    const result = await discoverSitemapSources(["", "https://example.com/pages.xml"], async (_url) => {
      return "<urlset><url><loc>https://example.com/page</loc></url></urlset>";
    });

    expect(result).toEqual({
      urls: [{ url: "https://example.com/page", source: "https://example.com/pages.xml" }],
      errors: [{ source: "", message: "Target must be a valid URL" }],
    });
  });

  it("rejects malformed XML", () => {
    expect(() => parseSitemapXml("<urlset><url>")).toThrow(/sitemap/i);
  });
});
