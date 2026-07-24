import {
  assertAllowedTarget,
  assertAllowedTargetResolved,
  type ResolveHostname,
  readResponseBody,
} from "@schemer/crawler";

export interface SitemapFetchOptions {
  sameOriginOnly: boolean;
  timeoutMs: number;
  maxResponseBytes: number;
  resolveHostname?: ResolveHostname;
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve sitemap discovery errors when cleanup fails.
  }
}

export async function fetchSitemapText(
  url: URL,
  maxRedirects: number,
  fetchImpl: typeof fetch = fetch,
  options: SitemapFetchOptions,
): Promise<string> {
  const initialUrl = await assertAllowedTargetResolved(url.href, options.resolveHostname);
  let currentUrl = initialUrl;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  try {
    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      let response: Response;
      try {
        response = await fetchImpl(currentUrl.href, {
          signal: controller.signal,
          redirect: "manual",
          headers: { accept: "application/xml,text/plain" },
        });
      } catch (error) {
        if (timedOut || controller.signal.aborted) throw new Error("Sitemap fetch timed out");
        throw new Error(`Sitemap fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await discardResponseBody(response);
        if (!location) throw new Error(`HTTP ${response.status}`);
        if (redirect === maxRedirects) throw new Error("Redirect limit exceeded");

        const nextUrl = assertAllowedTarget(new URL(location, currentUrl).href);
        if (options.sameOriginOnly && nextUrl.origin !== initialUrl.origin) {
          throw new Error("URL is outside the target origin");
        }
        currentUrl = await assertAllowedTargetResolved(nextUrl.href, options.resolveHostname);
        continue;
      }

      if (!response.ok) {
        await discardResponseBody(response);
        throw new Error(`HTTP ${response.status}`);
      }
      try {
        const bodyResult = await readResponseBody(response, options.maxResponseBytes);
        if (bodyResult.tooLarge) throw new Error("Sitemap response exceeds size limit");
        return bodyResult.body;
      } catch (error) {
        if (timedOut || controller.signal.aborted) throw new Error("Sitemap fetch timed out");
        throw error;
      }
    }

    throw new Error("Redirect limit exceeded");
  } finally {
    clearTimeout(timeout);
  }
}
