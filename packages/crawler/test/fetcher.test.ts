import { createServer, type RequestListener, type Server } from "node:http";
import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPage } from "../src/fetcher";
import {
  bodyByteLength,
  classifyHttpStatus,
  declaredResponseTooLarge,
  normalizeContentType,
  readResponseBody,
} from "../src/fetcher-response";

let server: Server | undefined;

afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
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

function fetchFromServer(base: string): typeof fetch {
  return async (input, init) => {
    const target = new URL(String(input));
    const local = new URL(base);
    target.protocol = local.protocol;
    target.host = local.host;
    return fetch(target, init);
  };
}

describe("page fetcher", () => {
  it("normalizes content types and classifies response statuses", () => {
    expect(normalizeContentType(" Text/HTML; charset=utf-8 ")).toBe("text/html");
    expect(normalizeContentType(null)).toBe("");
    expect(classifyHttpStatus(200)).toBe("ok");
    expect(classifyHttpStatus(302)).toBe("redirect");
    expect(classifyHttpStatus(404)).toBe("error");
  });

  it("checks declared and actual response sizes at exact boundaries", async () => {
    const response = new Response("1234", {
      headers: { "content-length": "4" },
    });

    expect(declaredResponseTooLarge(response, 4)).toBe(false);
    expect(declaredResponseTooLarge(response, 3)).toBe(true);
    const result = await readResponseBody(response, 4);
    expect(bodyByteLength(result.body)).toBe(4);
    expect(result.tooLarge).toBe(false);
  });

  it("enforces actual byte limits without relying on Content-Length", async () => {
    const responses = [
      new Response("éé", { headers: { "content-type": "text/html" } }),
      new Response("éé", {
        headers: { "content-length": "1", "content-type": "text/html" },
      }),
    ];

    for (const response of responses) {
      const result = await fetchPage(
        "https://example.com/page",
        { ...DEFAULT_SCAN_SETTINGS, maxResponseBytes: 3 },
        async () => response,
      );
      expect(result.status).toBe("too_large");
    }

    const result = await fetchPage(
      "https://example.com/page",
      { ...DEFAULT_SCAN_SETTINGS, maxResponseBytes: 4 },
      async () => new Response("éé", { headers: { "content-type": "text/html" } }),
    );
    expect(result).toMatchObject({ status: "ok", body: "éé" });
  });

  it("checks resolved addresses before the initial request and redirects", async () => {
    const resolveHostname = async (hostname: string) =>
      hostname === "public.example" ? ["10.0.0.4"] : ["203.0.113.10"];
    const fetchImpl = vi.fn<typeof fetch>();

    const initialResult = await fetchPage(
      "https://public.example/page",
      DEFAULT_SCAN_SETTINGS,
      fetchImpl,
      resolveHostname,
    );
    expect(initialResult).toMatchObject({ status: "fetch_error", message: expect.stringMatching(/private/) });
    expect(fetchImpl).not.toHaveBeenCalled();

    const redirectResult = await fetchPage(
      "https://safe.example/page",
      { ...DEFAULT_SCAN_SETTINGS, sameOriginOnly: false },
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://public.example/page" } })),
      resolveHostname,
    );
    expect(redirectResult).toMatchObject({ status: "fetch_error", message: expect.stringMatching(/private/) });
  });

  it("cancels and releases the reader when body reading fails", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
        pull(controller) {
          controller.error(new Error("read failed"));
        },
        cancel() {
          throw new Error("cleanup failed");
        },
      }),
    );

    await expect(readResponseBody(response, 10)).rejects.toThrow("read failed");
    expect(response.body?.locked).toBe(false);
  });

  it("preserves too-large classification when body cancellation fails", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("too large"));
        },
        cancel() {
          throw new Error("cleanup failed");
        },
      }),
      { headers: { "content-type": "text/html" } },
    );

    const result = await fetchPage(
      "https://example.com/large",
      { ...DEFAULT_SCAN_SETTINGS, maxResponseBytes: 1 },
      async () => response,
    );

    expect(result.status).toBe("too_large");
  });

  it("cancels bodies before early response returns", async () => {
    const canceled: string[] = [];
    const response = (label: string, status: number, headers: HeadersInit = {}) =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("body"));
          },
          cancel() {
            canceled.push(label);
          },
        }),
        { status, headers },
      );

    await fetchPage("https://example.com/redirect", DEFAULT_SCAN_SETTINGS, async () => response("redirect", 302));
    await fetchPage("https://example.com/error", DEFAULT_SCAN_SETTINGS, async () => response("error", 404));
    await fetchPage("https://example.com/json", DEFAULT_SCAN_SETTINGS, async () =>
      response("non-html", 200, { "content-type": "application/json" }),
    );
    await fetchPage("https://example.com/large", { ...DEFAULT_SCAN_SETTINGS, maxResponseBytes: 1 }, async () =>
      response("declared-large", 200, { "content-type": "text/html", "content-length": "2" }),
    );

    expect(canceled).toEqual(["redirect", "error", "non-html", "declared-large"]);
  });

  it("returns HTML response metadata and body", async () => {
    const base = await startServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end("<html>ok</html>");
    });

    const result = await fetchPage("https://example.com/page", DEFAULT_SCAN_SETTINGS, fetchFromServer(base));
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

    expect((await fetchPage("https://example.com/error", DEFAULT_SCAN_SETTINGS, fetchFromServer(base))).status).toBe(
      "http_error",
    );
    expect((await fetchPage("https://example.com/json", DEFAULT_SCAN_SETTINGS, fetchFromServer(base))).status).toBe(
      "not_html",
    );
  });

  it("classifies response-size limits", async () => {
    const base = await startServer((_request, response) => {
      response.setHeader("content-type", "text/html");
      response.end("123456789");
    });

    const result = await fetchPage(
      "https://example.com/large",
      { ...DEFAULT_SCAN_SETTINGS, maxResponseBytes: 4 },
      fetchFromServer(base),
    );
    expect(result.status).toBe("too_large");
  });

  it("follows relative redirects", async () => {
    const base = await startServer((request, response) => {
      if (request.url === "/start") {
        response.statusCode = 302;
        response.setHeader("location", "/final");
        response.end();
        return;
      }
      response.setHeader("content-type", "text/html");
      response.end("final");
    });

    const result = await fetchPage("https://example.com/start", DEFAULT_SCAN_SETTINGS, fetchFromServer(base));
    expect(result).toMatchObject({ status: "ok", body: "final" });
  });

  it("validates the initial target and redirect targets", async () => {
    let calls = 0;
    const initialResult = await fetchPage("http://127.0.0.1/private", DEFAULT_SCAN_SETTINGS, async () => {
      calls += 1;
      return new Response("unexpected", { headers: { "content-type": "text/html" } });
    });
    expect(initialResult).toMatchObject({ status: "fetch_error", message: expect.stringContaining("private") });
    expect(calls).toBe(0);

    const redirectResult = await fetchPage("https://example.com/start", DEFAULT_SCAN_SETTINGS, async () => {
      calls += 1;
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    });
    expect(redirectResult).toMatchObject({ status: "fetch_error", message: expect.stringContaining("private") });
    expect(calls).toBe(1);

    const invalidResult = await fetchPage(
      "https://example.com/start",
      DEFAULT_SCAN_SETTINGS,
      async () => new Response(null, { status: 302, headers: { location: "http://[" } }),
    );
    expect(invalidResult).toMatchObject({ status: "fetch_error", message: expect.stringContaining("valid URL") });
  });

  it("rejects cross-origin redirects when same-origin policy is enabled", async () => {
    let calls = 0;
    const result = await fetchPage(
      "https://example.com/start",
      DEFAULT_SCAN_SETTINGS,
      async () => {
        calls += 1;
        return new Response(null, { status: 302, headers: { location: "https://other.example/final" } });
      },
      async () => ["203.0.113.10"],
    );

    expect(result).toMatchObject({ status: "fetch_error", message: "URL is outside the target origin" });
    expect(calls).toBe(1);
  });

  it("allows public cross-origin redirects when same-origin policy is disabled", async () => {
    const requested: string[] = [];
    const result = await fetchPage(
      "https://example.com/start",
      { ...DEFAULT_SCAN_SETTINGS, sameOriginOnly: false },
      async (input) => {
        requested.push(String(input));
        if (requested.length === 1) {
          return new Response(null, { status: 302, headers: { location: "https://other.example/final" } });
        }
        return new Response("final", { headers: { "content-type": "text/html" } });
      },
      async () => ["203.0.113.10"],
    );

    expect(result).toMatchObject({ status: "ok", body: "final" });
    expect(requested).toEqual(["https://example.com/start", "https://other.example/final"]);
  });

  it("reports missing locations and redirect limits", async () => {
    const base = await startServer((request, response) => {
      response.statusCode = 302;
      response.setHeader("location", request.url === "/one" ? "/two" : "/one");
      if (request.url === "/missing") response.removeHeader("location");
      response.end();
    });

    const missingLocation = await fetchPage(
      "https://example.com/missing",
      DEFAULT_SCAN_SETTINGS,
      fetchFromServer(base),
    );
    expect(missingLocation.status).toBe("fetch_error");
    if (missingLocation.status === "fetch_error") {
      expect(missingLocation.message).toBe("Redirect limit exceeded");
    }

    const limitedRedirect = await fetchPage(
      "https://example.com/one",
      {
        ...DEFAULT_SCAN_SETTINGS,
        maxRedirects: 1,
      },
      fetchFromServer(base),
    );
    expect(limitedRedirect.status).toBe("fetch_error");
    if (limitedRedirect.status === "fetch_error") {
      expect(limitedRedirect.message).toBe("Redirect limit exceeded");
    }
  });

  it("reports timeout and network errors", async () => {
    const timeoutResult = await fetchPage(
      "https://example.com/slow",
      { ...DEFAULT_SCAN_SETTINGS, timeoutMs: 10 },
      async (_input, init) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (init?.signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
        throw new Error("request completed unexpectedly");
      },
    );
    expect(timeoutResult.status).toBe("fetch_error");
    if (timeoutResult.status === "fetch_error") {
      expect(timeoutResult.message).toContain("aborted");
    }

    const networkResult = await fetchPage("https://example.com/unreachable", DEFAULT_SCAN_SETTINGS, async () => {
      throw new Error("network unavailable");
    });
    expect(networkResult).toMatchObject({ status: "fetch_error", message: "network unavailable" });
  });

  it("handles missing content types and 3xx/4xx responses", async () => {
    const base = await startServer((request, response) => {
      if (request.url === "/redirect") {
        response.statusCode = 301;
        response.end();
        return;
      }
      response.statusCode = 418;
      response.end("teapot");
    });

    expect((await fetchPage("https://example.com/redirect", DEFAULT_SCAN_SETTINGS, fetchFromServer(base))).status).toBe(
      "fetch_error",
    );
    expect((await fetchPage("https://example.com/error", DEFAULT_SCAN_SETTINGS, fetchFromServer(base))).status).toBe(
      "http_error",
    );
    expect(
      (await fetchPage("https://example.com/error", DEFAULT_SCAN_SETTINGS, fetchFromServer(base))).contentType,
    ).toBe("");
  });
});
