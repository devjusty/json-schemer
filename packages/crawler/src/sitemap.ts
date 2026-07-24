import { DEFAULT_SCAN_SETTINGS } from "@schemer/domain";
import { parseRobots } from "./robots";
import { discoverSitemapSources } from "./sitemap-discovery";
import type { DiscoveryResult } from "./sitemap-types";

export { parseSitemapXml } from "./sitemap-parser";
export type { DiscoveredSitemapUrl, DiscoveryResult, SitemapDocument } from "./sitemap-types";

export async function discoverSitemaps(
  siteUrl: URL,
  fetchText: (url: URL, maxRedirects: number) => Promise<string>,
  maxRedirects: number = DEFAULT_SCAN_SETTINGS.maxRedirects,
): Promise<DiscoveryResult> {
  const queue: string[] = [`${siteUrl.origin}/sitemap.xml`, `${siteUrl.origin}/sitemap_index.xml`];
  const errors: DiscoveryResult["errors"] = [];

  try {
    const robotsUrl = new URL("/robots.txt", siteUrl);
    const robots = parseRobots(await fetchText(robotsUrl, maxRedirects), "json-schemer");
    queue.push(...robots.sitemaps);
  } catch (error) {
    errors.push({
      source: `${siteUrl.origin}/robots.txt`,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const result = await discoverSitemapSources(queue, fetchText, maxRedirects);
  return { urls: result.urls, errors: [...errors, ...result.errors] };
}
