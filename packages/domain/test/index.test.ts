import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_SETTINGS, PAGE_STATUSES } from "../src/index";

describe("domain contracts", () => {
  it("uses balanced crawl defaults", () => {
    expect(DEFAULT_SCAN_SETTINGS).toMatchObject({
      maxUrls: 500,
      concurrency: 4,
      delayMs: 250,
      respectRobots: true,
      sameOriginOnly: true,
    });
  });

  it("defines invalid JSON-LD as a distinct page status", () => {
    expect(PAGE_STATUSES).toContain("invalid_jsonld");
    expect(PAGE_STATUSES).toContain("no_jsonld");
  });
});
