import type { ScanSettings } from "@schemer/domain";
import {
  bodyByteLength,
  classifyHttpStatus,
  declaredResponseTooLarge,
  discardResponseBody,
  normalizeContentType,
  readResponseBody,
} from "./fetcher-response";
import { assertAllowedTarget, assertAllowedTargetResolved, type ResolveHostname } from "./url-policy";

export type FetchResult =
  | { status: "ok"; httpStatus: number; contentType: string; body: string; durationMs: number }
  | { status: "http_error"; httpStatus: number; contentType: string; message: string; durationMs: number }
  | { status: "not_html"; httpStatus: number; contentType: string; message: string; durationMs: number }
  | { status: "too_large"; httpStatus: number; contentType: string; message: string; durationMs: number }
  | { status: "fetch_error"; httpStatus: null; contentType: null; message: string; durationMs: number };

export async function fetchPage(
  input: string,
  settings: Pick<ScanSettings, "timeoutMs" | "maxResponseBytes" | "maxRedirects" | "sameOriginOnly">,
  fetchImpl: typeof fetch = fetch,
  resolveHostname?: ResolveHostname,
): Promise<FetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);

  try {
    const initialUrl = await assertAllowedTargetResolved(input, resolveHostname);
    let currentUrl = initialUrl.href;
    for (let redirect = 0; redirect <= settings.maxRedirects; redirect += 1) {
      const response = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      const contentType = normalizeContentType(response.headers.get("content-type"));
      const durationMs = Date.now() - started;

      const statusClass = classifyHttpStatus(response.status);
      if (statusClass === "redirect") {
        const location = response.headers.get("location");
        if (!location || redirect === settings.maxRedirects) {
          await discardResponseBody(response);
          return {
            status: "fetch_error",
            httpStatus: null,
            contentType: null,
            message: "Redirect limit exceeded",
            durationMs,
          };
        }
        await discardResponseBody(response);
        const nextUrl = assertAllowedTarget(new URL(location, currentUrl).href);
        if (settings.sameOriginOnly && nextUrl.origin !== initialUrl.origin) {
          throw new Error("URL is outside the target origin");
        }
        const allowedNextUrl = await assertAllowedTargetResolved(nextUrl.href, resolveHostname);
        currentUrl = allowedNextUrl.href;
        continue;
      }

      if (statusClass === "error") {
        await discardResponseBody(response);
        return {
          status: "http_error",
          httpStatus: response.status,
          contentType,
          message: `HTTP ${response.status}`,
          durationMs,
        };
      }
      if (!contentType.includes("html")) {
        await discardResponseBody(response);
        return {
          status: "not_html",
          httpStatus: response.status,
          contentType,
          message: "Response is not HTML",
          durationMs,
        };
      }
      if (declaredResponseTooLarge(response, settings.maxResponseBytes)) {
        await discardResponseBody(response);
        return {
          status: "too_large",
          httpStatus: response.status,
          contentType,
          message: "Response exceeds size limit",
          durationMs,
        };
      }

      const bodyResult = await readResponseBody(response, settings.maxResponseBytes);
      if (bodyResult.tooLarge || bodyByteLength(bodyResult.body) > settings.maxResponseBytes) {
        return {
          status: "too_large",
          httpStatus: response.status,
          contentType,
          message: "Response exceeds size limit",
          durationMs,
        };
      }
      return { status: "ok", httpStatus: response.status, contentType, body: bodyResult.body, durationMs };
    }
    throw new Error("Redirect limit exceeded");
  } catch (error) {
    return {
      status: "fetch_error",
      httpStatus: null,
      contentType: null,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}
