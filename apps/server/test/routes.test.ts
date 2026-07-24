import { describe, expect, it } from "vitest";
import { createDatabase, createRepositories } from "@schemer/storage";
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
});
