import { describe, expect, it } from "vitest";
import { parseRobots } from "../src/robots";

describe("robots rules", () => {
  it("selects the most specific matching user-agent group", () => {
    const rules = parseRobots(
      [
        "User-agent: *",
        "Disallow: /",
        "User-agent: json",
        "Disallow: /private",
        "User-agent: json-schemer",
        "Allow: /",
      ].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/private/item"))).toBe(true);
  });

  it("merges rules from all groups matching the most specific agent", () => {
    const rules = parseRobots(
      ["User-agent: json-schemer", "Disallow: /first", "", "User-agent: json-schemer", "Disallow: /second"].join(
        "\n",
      ),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/first"))).toBe(false);
    expect(rules.isAllowed(new URL("https://example.com/second"))).toBe(false);
  });

  it("ends an agent group at a blank line", () => {
    const rules = parseRobots(
      ["User-agent: crawler", "", "User-agent: json-schemer", "Disallow: /private", "User-agent: *", "Allow: /"].join(
        "\n",
      ),
      "crawler",
    );

    expect(rules.isAllowed(new URL("https://example.com/private"))).toBe(true);
  });

  it("uses wildcard rules when no specific group matches", () => {
    const rules = parseRobots(
      ["User-agent: other", "Disallow: /private", "User-agent: *", "Disallow: /admin"].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/admin"))).toBe(false);
    expect(rules.isAllowed(new URL("https://example.com/private"))).toBe(true);
  });

  it("merges rules from repeated wildcard groups", () => {
    const rules = parseRobots(
      ["User-agent: *", "Disallow: /first", "", "User-agent: *", "Disallow: /second"].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/first"))).toBe(false);
    expect(rules.isAllowed(new URL("https://example.com/second"))).toBe(false);
  });

  it("supports multiple agents and groups with comments and whitespace", () => {
    const rules = parseRobots(
      [
        "  User-agent: crawler # shared group",
        "User-agent: json-schemer",
        " Disallow: /private  # hidden",
        "",
        " User-agent: *",
        " Allow: /",
      ].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/private"))).toBe(false);
    expect(rules.isAllowed(new URL("https://example.com/public"))).toBe(true);
  });

  it("deduplicates non-empty sitemap directives", () => {
    const rules = parseRobots(
      [
        "Sitemap: https://example.com/sitemap.xml",
        "Sitemap: https://example.com/sitemap.xml # duplicate",
        "Sitemap:",
        "User-agent: *",
      ].join("\n"),
      "json-schemer",
    );

    expect(rules.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("ignores empty directives and malformed lines", () => {
    const rules = parseRobots(
      ["User-agent:", "Disallow:", "Allow:", "not a directive", ":", "User-agent: *", "Allow: /public"].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/private"))).toBe(true);
    expect(rules.isAllowed(new URL("https://example.com/public"))).toBe(true);
  });

  it("does not let an empty user-agent override wildcard rules", () => {
    const rules = parseRobots(
      ["User-agent:", "Disallow: /blocked", "User-agent: *", "Allow: /"].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/blocked"))).toBe(true);
  });

  it("allows all URLs when robots text is unavailable", () => {
    const rules = parseRobots("", "json-schemer");
    expect(rules.isAllowed(new URL("https://example.com/anything"))).toBe(true);
  });

  it("uses longest matching path with allow precedence", () => {
    const rules = parseRobots(
      ["User-agent: *", "Disallow: /private", "Allow: /private/public", "Disallow: /private/public/secret"].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/private/item"))).toBe(false);
    expect(rules.isAllowed(new URL("https://example.com/private/public/item"))).toBe(true);
    expect(rules.isAllowed(new URL("https://example.com/private/public/secret/item"))).toBe(false);
  });

  it("prefers allow when matching rule paths have equal length", () => {
    const rules = parseRobots(
      [
        "User-agent: *",
        "Disallow: /blocked-first",
        "Allow: /blocked-first",
        "Allow: /blocked-second",
        "Disallow: /blocked-second",
      ].join("\n"),
      "json-schemer",
    );

    expect(rules.isAllowed(new URL("https://example.com/blocked-first"))).toBe(true);
    expect(rules.isAllowed(new URL("https://example.com/blocked-second"))).toBe(true);
  });

  it("starts a new group after unsupported directives", () => {
    const rules = parseRobots(
      ["User-agent: other", "Crawl-delay: 5", "User-agent: *", "Disallow: /blocked"].join("\n"),
      "other",
    );

    expect(rules.isAllowed(new URL("https://example.com/blocked"))).toBe(true);
  });
});
