import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { parseSitemapXml } from "./sitemap-parser";
import type { DiscoveryResult, SitemapDocument } from "./sitemap-types";
import { assertAllowedTarget } from "./url-policy";

export async function discoverSitemapSources(
  sources: string[],
  fetchText: (url: URL, maxRedirects: number) => Promise<string>,
  maxRedirects: number = DEFAULT_SCAN_SETTINGS.maxRedirects,
): Promise<DiscoveryResult> {
  const queue = [...sources];
  const visited = new Set<string>();
  const urls: DiscoveryResult["urls"] = [];
  const errors: DiscoveryResult["errors"] = [];

  while (queue.length > 0) {
    const source = queue.shift();
    if (source === undefined) break;

    let canonicalSource = source;
    try {
      const parsedUrl = new URL(source);
      parsedUrl.hash = "";
      canonicalSource = parsedUrl.href;
    } catch {
      // Preserve invalid source for policy validation and error reporting.
    }
    if (visited.has(canonicalSource)) continue;
    visited.add(canonicalSource);

    let document: SitemapDocument;
    try {
      const canonicalUrl = assertAllowedTarget(canonicalSource);
      canonicalUrl.hash = "";
      document = parseSitemapXml(await fetchText(canonicalUrl, maxRedirects));
    } catch (error) {
      errors.push({ source, message: error instanceof Error ? error.message : String(error) });
      continue;
    }

    if (document.kind === "index") {
      queue.push(...document.sitemaps);
    } else {
      urls.push(...document.urls.map((url) => ({ url, source })));
    }
  }

  return { urls, errors };
}
