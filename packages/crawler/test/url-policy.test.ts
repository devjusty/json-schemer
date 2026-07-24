import { describe, expect, it } from "vitest";
import { assertAllowedTarget, filterSitemapUrls, normalizeUrl } from "../src/url-policy";

describe("URL policy", () => {
  it("accepts public HTTP(S) targets and rejects unsafe targets", () => {
    expect(assertAllowedTarget("https://example.com").hostname).toBe("example.com");
    expect(() => assertAllowedTarget("file:///tmp/site")).toThrow(/HTTP/);
    expect(() => assertAllowedTarget("http://localhost:3000")).toThrow(/private/);
    expect(() => assertAllowedTarget("http://127.0.0.1")).toThrow(/private/);
    expect(() => assertAllowedTarget("http://192.168.1.4")).toThrow(/private/);
    expect(() => assertAllowedTarget("https://user:password@example.com")).toThrow(/credentials/);
  });

  it("normalizes same-origin URLs and removes fragments", () => {
    const origin = new URL("https://example.com");
    expect(normalizeUrl("https://example.com:443/products#details", origin)).toBe(
      "https://example.com/products",
    );
    expect(() => normalizeUrl("https://other.example/products", origin)).toThrow(/origin/);
  });

  it("deduplicates and caps sitemap URLs while preserving order", () => {
    const origin = new URL("https://example.com");
    expect(
      filterSitemapUrls(
        ["https://example.com/a#x", "https://example.com/a", "https://example.com/b"],
        origin,
        2,
      ),
    ).toEqual(["https://example.com/a", "https://example.com/b"]);
  });
});
