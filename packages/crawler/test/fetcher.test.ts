import { createServer, type RequestListener, type Server } from "node:http";
import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { afterEach, describe, expect, it } from "vitest";
import { fetchPage } from "../src/fetcher";

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = undefined;
});

function startServer(handler: RequestListener): Promise<string> {
  const currentServer = createServer(handler);
  server = currentServer;
  return new Promise((resolve) =>
    currentServer.listen(0, "127.0.0.1", () => {
      const address = currentServer.address();
      if (!address || typeof address === "string") throw new Error("server did not start");
      resolve(`http://127.0.0.1:${address.port}`);
    }),
  );
}

describe("page fetcher", () => {
  it("returns HTML response metadata and body", async () => {
    const base = await startServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end("<html>ok</html>");
    });

    const result = await fetchPage(`${base}/page`, DEFAULT_SCAN_SETTINGS);
    expect(result).toMatchObject({ status: "ok", httpStatus: 200, contentType: "text/html" });
    if (result.status === "ok") expect(result.body).toBe("<html>ok</html>");
  });

  it("classifies HTTP errors and non-HTML responses", async () => {
    const base = await startServer((request, response) => {
      if (request.url === "/error") {
        response.statusCode = 404;
        response.end("missing");
      } else {
        response.setHeader("content-type", "application/json");
        response.end("{}");
      }
    });

    expect((await fetchPage(`${base}/error`, DEFAULT_SCAN_SETTINGS)).status).toBe("http_error");
    expect((await fetchPage(`${base}/json`, DEFAULT_SCAN_SETTINGS)).status).toBe("not_html");
  });

  it("classifies response-size limits", async () => {
    const base = await startServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end("123456789");
    });

    const result = await fetchPage(`${base}/large`, { ...DEFAULT_SCAN_SETTINGS, maxResponseBytes: 4 });
    expect(result.status).toBe("too_large");
  });
});
