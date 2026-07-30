function sanitizeSegment(value: string, fallback: string): string {
  const cleaned = value
    .replaceAll(/[^a-zA-Z0-9._-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^[.-]+|[.-]+$/g, "");
  return cleaned || fallback;
}

function hostnameOf(url: string): string {
  try {
    return sanitizeSegment(new URL(url).hostname, "scan");
  } catch {
    return "scan";
  }
}

function pagePathSlug(pageUrl: string): string {
  try {
    const parts = new URL(pageUrl).pathname
      .split("/")
      .map((part) => sanitizeSegment(part, ""))
      .filter(Boolean);
    if (parts.length === 0) return "home";
    return parts.slice(-2).join("-").slice(0, 80) || "page";
  } catch {
    return "page";
  }
}

/** Basename (no extension) for Content-Disposition download names. */
export function exportBasename(targetUrl: string, scope: "site" | "page", pageUrl?: string): string {
  const host = hostnameOf(targetUrl);
  if (scope === "site") return `${host}-schema-scan`;
  const slug = pageUrl ? pagePathSlug(pageUrl) : "page";
  return `${host}-${slug}-schema-page`;
}

export function exportExtension(format: "json" | "markdown" | "csv"): string {
  return format === "markdown" ? "md" : format;
}

export function contentDispositionAttachment(basename: string, format: "json" | "markdown" | "csv"): string {
  const filename = `${basename}.${exportExtension(format)}`;
  const escaped = filename.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `attachment; filename="${escaped}"`;
}
