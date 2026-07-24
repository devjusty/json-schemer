import { describe, expect, it } from "vitest";
import { parseRobots } from "../src/robots";

describe("robots rules", () => {
  it("applies user-agent rules and sitemap directives", () => {
    const rules = parseRobots(
      [
        "User-agent: *",
        "Disallow: /private",
        "Allow: /private/public",
        "Sitemap: https://example.com/sitemap.xml",
      ].join("\n"),
      "jason-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/private/item"))).toBe(false);
    expect(rules.isAllowed(new URL("https://example.com/private/public"))).toBe(true);
    expect(rules.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("allows all URLs when robots text is unavailable", () => {
    const rules = parseRobots("", "jason-schemer");
    expect(rules.isAllowed(new URL("https://example.com/anything"))).toBe(true);
  });
});
