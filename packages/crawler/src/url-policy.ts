import ipaddr from "ipaddr.js";

function isPrivateAddress(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    return true;
  }

  if (!ipaddr.isValid(normalized)) {
    return false;
  }

  const address = ipaddr.process(normalized);
  return ["private", "loopback", "linkLocal", "uniqueLocal", "unspecified", "carrierGradeNat"].includes(
    address.range(),
  );
}

export function assertAllowedTarget(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Target must be a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Target must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Target must not include credentials");
  }
  if (isPrivateAddress(url.hostname)) {
    throw new Error("Target must not resolve to a private network");
  }

  return url;
}

export function normalizeUrl(input: string, origin: URL): string {
  const url = assertAllowedTarget(input);
  if (url.origin !== origin.origin) {
    throw new Error("URL is outside the target origin");
  }
  url.hash = "";
  return url.href;
}

export function filterSitemapUrls(urls: string[], origin: URL, maxUrls: number): string[] {
  const unique = new Set<string>();
  for (const input of urls) {
    if (unique.size >= maxUrls) break;
    try {
      unique.add(normalizeUrl(input, origin));
    } catch {
      // Sitemap entries outside scan policy are intentionally skipped.
    }
  }
  return [...unique];
}
