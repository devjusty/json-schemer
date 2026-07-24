export type HttpStatusClass = "ok" | "redirect" | "error";

export function normalizeContentType(value: string | null): string {
  return value?.split(";", 1)[0].trim().toLowerCase() ?? "";
}

export function classifyHttpStatus(status: number): HttpStatusClass {
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400) return "error";
  return "ok";
}

export function declaredResponseTooLarge(response: Response, maxBytes: number): boolean {
  const declaredLength = Number(response.headers.get("content-length"));
  return Number.isFinite(declaredLength) && declaredLength > maxBytes;
}

export async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve response classification when cleanup fails.
  }
}

export async function readResponseBody(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; tooLarge: boolean }> {
  if (!response.body) return { body: "", tooLarge: false };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve size classification when cleanup fails.
        }
        return { body: "", tooLarge: true };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { body: new TextDecoder().decode(bytes), tooLarge: false };
  } catch (error) {
    try {
      await reader.cancel();
    } catch {
      // Preserve original read error when cleanup fails.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export function bodyByteLength(body: string): number {
  return new TextEncoder().encode(body).byteLength;
}
