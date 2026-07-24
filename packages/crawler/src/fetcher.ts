import type { ScanSettings } from "@schemer/domain";

export type FetchResult =
  | { status: "ok"; httpStatus: number; contentType: string; body: string; durationMs: number }
  | { status: "http_error"; httpStatus: number; contentType: string; message: string; durationMs: number }
  | { status: "not_html"; httpStatus: number; contentType: string; message: string; durationMs: number }
  | { status: "too_large"; httpStatus: number; contentType: string; message: string; durationMs: number }
  | { status: "fetch_error"; httpStatus: null; contentType: null; message: string; durationMs: number };

function contentTypeOf(response: Response): string {
  return response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
}

export async function fetchPage(
  input: string,
  settings: Pick<ScanSettings, "timeoutMs" | "maxResponseBytes" | "maxRedirects">,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.timeoutMs);
  let currentUrl = input;

  try {
    for (let redirect = 0; redirect <= settings.maxRedirects; redirect += 1) {
      const response = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      const contentType = contentTypeOf(response);
      const durationMs = Date.now() - started;

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === settings.maxRedirects) {
          return { status: "fetch_error", httpStatus: null, contentType: null, message: "Redirect limit exceeded", durationMs };
        }
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      if (response.status >= 400) {
        return { status: "http_error", httpStatus: response.status, contentType, message: `HTTP ${response.status}`, durationMs };
      }
      if (!contentType.includes("html")) {
        return { status: "not_html", httpStatus: response.status, contentType, message: "Response is not HTML", durationMs };
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > settings.maxResponseBytes) {
        return { status: "too_large", httpStatus: response.status, contentType, message: "Response exceeds size limit", durationMs };
      }

      const body = await response.text();
      if (new TextEncoder().encode(body).byteLength > settings.maxResponseBytes) {
        return { status: "too_large", httpStatus: response.status, contentType, message: "Response exceeds size limit", durationMs };
      }
      return { status: "ok", httpStatus: response.status, contentType, body, durationMs };
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
