import { describe, expect, it, vi } from "vitest";
import { fetchSitemapText } from "../src/scan/sitemap-fetcher";

function response(status: number, headers: HeadersInit = {}, body = "sitemap") {
  const cancel = vi.fn().mockResolvedValue(undefined);
  const encodedBody = new TextEncoder().encode(body);
  let consumed = false;
  const reader = {
    read: vi.fn(async () => {
      if (consumed) return { done: true, value: undefined };
      consumed = true;
      return { done: false, value: encodedBody };
    }),
    cancel,
    releaseLock: vi.fn(),
  };
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    body: { cancel, getReader: () => reader },
    text: vi.fn().mockResolvedValue(body),
    cancel,
  } as unknown as Response & { cancel: ReturnType<typeof vi.fn> };
}

function streamedResponse(status: number, chunks: Uint8Array[], headers: HeadersInit = {}) {
  let index = 0;
  const cancel = vi.fn().mockResolvedValue(undefined);
  const releaseLock = vi.fn();
  const reader = {
    read: vi.fn(async () => {
      const value = chunks[index++];
      return value ? { done: false, value } : { done: true, value: undefined };
    }),
    cancel,
    releaseLock,
  };
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    body: { getReader: () => reader, cancel },
    reader,
  } as unknown as Response & {
    cancel: ReturnType<typeof vi.fn>;
    reader: typeof reader;
  };
}

const fetchOptions = {
  sameOriginOnly: true,
  timeoutMs: 1_000,
  maxResponseBytes: 1_000,
  resolveHostname: async () => ["203.0.113.10"],
};

describe("fetchSitemapText", () => {
  it("rejects redirect destinations outside initial origin by default", async () => {
    const redirect = response(302, { location: "https://cdn.example/sitemap.xml" });
    const fetchImpl = vi.fn().mockResolvedValue(redirect);

    await expect(
      fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, fetchImpl, fetchOptions),
    ).rejects.toThrow("URL is outside the target origin");
    expect(redirect.cancel).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects sitemap hosts that resolve to private addresses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, {}, "<urlset />"));

    await expect(
      fetchSitemapText(new URL("https://public.example/sitemap.xml"), 3, fetchImpl, {
        ...fetchOptions,
        resolveHostname: async () => ["192.168.1.4"],
      }),
    ).rejects.toThrow("private");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("allows cross-origin redirects when same-origin enforcement is disabled", async () => {
    const redirect = response(302, { location: "https://cdn.example/sitemap.xml" });
    const success = response(200, {}, "<urlset />");
    const fetchImpl = vi.fn().mockResolvedValueOnce(redirect).mockResolvedValueOnce(success);

    await expect(
      fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, fetchImpl, {
        ...fetchOptions,
        sameOriginOnly: false,
      }),
    ).resolves.toBe("<urlset />");
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://cdn.example/sitemap.xml", expect.anything());
    expect(redirect.cancel).toHaveBeenCalledOnce();
  });

  it("releases response bodies before reporting HTTP and redirect errors", async () => {
    const httpError = response(404);
    const fetchHttpError = vi.fn().mockResolvedValue(httpError);
    await expect(
      fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, fetchHttpError, fetchOptions),
    ).rejects.toThrow("HTTP 404");
    expect(httpError.cancel).toHaveBeenCalledOnce();

    const redirectWithoutLocation = response(302);
    const fetchRedirectError = vi.fn().mockResolvedValue(redirectWithoutLocation);
    await expect(
      fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, fetchRedirectError, fetchOptions),
    ).rejects.toThrow("HTTP 302");
    expect(redirectWithoutLocation.cancel).toHaveBeenCalledOnce();
  });

  it("aborts slow sitemap fetches and reports a timeout", async () => {
    vi.useFakeTimers();
    try {
      let signal!: AbortSignal;
      const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal as AbortSignal;
        return new Promise<Response>((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      });
      const fetchPromise = fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, fetchImpl, {
        ...fetchOptions,
        timeoutMs: 25,
      });
      const timeoutAssertion = expect(fetchPromise).rejects.toThrow("Sitemap fetch timed out");
      await vi.advanceTimersByTimeAsync(25);

      await timeoutAssertion;
      expect(signal.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("limits streamed response bytes using UTF-8 byte length", async () => {
    const body = new TextEncoder().encode("éé");
    const result = streamedResponse(200, [body.slice(0, 1), body.slice(1)]);
    const fetchImpl = vi.fn().mockResolvedValue(result);

    await expect(
      fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, fetchImpl, {
        ...fetchOptions,
        maxResponseBytes: 3,
      }),
    ).rejects.toThrow("Sitemap response exceeds size limit");
    expect(result.reader.cancel).toHaveBeenCalledOnce();
    expect(result.reader.releaseLock).toHaveBeenCalledOnce();
  });

  it("decodes multibyte streamed bodies after counting bytes", async () => {
    const result = streamedResponse(200, [new TextEncoder().encode("é")]);

    await expect(
      fetchSitemapText(new URL("https://example.com/sitemap.xml"), 3, vi.fn().mockResolvedValue(result), {
        ...fetchOptions,
        maxResponseBytes: 2,
      }),
    ).resolves.toBe("é");
    expect(result.reader.releaseLock).toHaveBeenCalledOnce();
  });
});
