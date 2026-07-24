import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { createDatabase, createRepositories } from "@schemer/storage";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/http/routes";

describe("HTTP routes", () => {
  it("validates scan input", async () => {
    const repositories = createRepositories(createDatabase(":memory:"));
    const app = await createApp({ repositories, manager: {} as never });
    const response = await app.inject({ method: "POST", url: "/api/scans", payload: { targetUrl: "not-a-url" } });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "Target URL must be valid HTTP(S)" });
    await app.close();
  });

  it("rejects exports while scan is active", async () => {
    const repositories = createRepositories(createDatabase(":memory:"));
    repositories.replaceActiveScan({
      id: "scan-1",
      targetUrl: "https://example.com",
      sitemapUrl: null,
      settings: DEFAULT_SCAN_SETTINGS,
    });
    repositories.updateScanProgress("scan-1", {
      status: "crawling",
      discovered: 1,
      queued: 1,
      completed: 0,
      successful: 0,
      failed: 0,
    });
    const app = await createApp({ repositories, manager: {} as never });
    const response = await app.inject({ method: "GET", url: "/api/scans/scan-1/export/json" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "Scan is still active" });
    await app.close();
  });
});
