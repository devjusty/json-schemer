import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { createDatabase, createRepositories } from "@schemer/storage";
import { request } from "node:http";
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

  it("subscribes before sending initial scan state", async () => {
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
    const scan = repositories.getActiveScan();
    if (!scan) throw new Error("Expected active scan");
    const manager = {
      get: (scanId: string) => (scanId === scan.id ? scan : null),
      subscribe: (_scanId: string, next: (event: unknown) => void) => {
        next({
          type: "progress",
          progress: {
            scanId: scan.id,
            status: "crawling",
            discovered: 1,
            queued: 1,
            completed: 0,
            successful: 0,
            failed: 0,
          },
        });
        return () => undefined;
      },
    };
    const app = await createApp({ repositories, manager: manager as never });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Expected server address");
    const responseBody = await new Promise<string>((resolve, reject) => {
      const response = request({ host: "127.0.0.1", port: address.port, path: "/api/scans/scan-1/events" }, (incoming) => {
        let body = "";
        const timeout = setTimeout(() => reject(new Error("Timed out waiting for initial SSE events")), 1_000);
        incoming.on("data", (chunk: Buffer) => {
          body += chunk.toString();
          if (body.includes('"type":"progress"') && body.includes('"type":"scan_state"')) {
            clearTimeout(timeout);
            resolve(body);
            incoming.destroy();
          }
        });
        incoming.once("error", reject);
      });
      response.once("error", reject);
      response.end();
    });

    expect(responseBody).toContain('"type":"progress"');
    expect(responseBody).toContain('"type":"scan_state"');
    expect(responseBody.indexOf('"type":"progress"')).toBeLessThan(responseBody.indexOf('"type":"scan_state"'));
    expect(responseBody).toContain('"status":"crawling"');
    await app.close();
  });
});
