import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parseRobots } from "./robots";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  processEntities: false,
  isArray: (name) => name === "url" || name === "sitemap",
});

export type SitemapDocument =
  | { kind: "urlset"; urls: string[] }
  | { kind: "index"; sitemaps: string[] };

export interface DiscoveredSitemapUrl {
  url: string;
  source: string;
}

export interface DiscoveryResult {
  urls: DiscoveredSitemapUrl[];
  errors: Array<{ source: string; message: string }>;
}

function values(nodes: unknown): string[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((node) => (typeof node === "string" ? node : (node as { loc?: unknown }).loc))
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => value.trim());
}

export function parseSitemapXml(xml: string): SitemapDocument {
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`Invalid sitemap XML: ${validation.err.msg}`);

  let document: Record<string, unknown>;
  try {
    document = parser.parse(xml) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid sitemap XML: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (document.urlset) {
    return { kind: "urlset", urls: values((document.urlset as { url?: unknown }).url) };
  }
  if (document.sitemapindex) {
    return { kind: "index", sitemaps: values((document.sitemapindex as { sitemap?: unknown }).sitemap) };
  }
  throw new Error("Sitemap XML must contain urlset or sitemapindex");
}

export async function discoverSitemaps(
  siteUrl: URL,
  fetchText: (url: URL) => Promise<string>,
): Promise<DiscoveryResult> {
  const errors: DiscoveryResult["errors"] = [];
  const discovered: DiscoveredSitemapUrl[] = [];
  const visited = new Set<string>();
  const queue: string[] = [
    `${siteUrl.origin}/sitemap.xml`,
    `${siteUrl.origin}/sitemap_index.xml`,
  ];

  try {
    const robotsUrl = new URL("/robots.txt", siteUrl);
    const robots = parseRobots(await fetchText(robotsUrl), "jason-schemer");
    queue.push(...robots.sitemaps);
  } catch (error) {
    errors.push({ source: `${siteUrl.origin}/robots.txt`, message: error instanceof Error ? error.message : String(error) });
  }

  while (queue.length > 0) {
    const source = queue.shift()!;
    if (visited.has(source)) continue;
    visited.add(source);

    let document: SitemapDocument;
    try {
      document = parseSitemapXml(await fetchText(new URL(source)));
    } catch (error) {
      errors.push({ source, message: error instanceof Error ? error.message : String(error) });
      continue;
    }

    if (document.kind === "index") {
      queue.push(...document.sitemaps);
    } else {
      discovered.push(...document.urls.map((url) => ({ url, source })));
    }
  }

  return { urls: discovered, errors };
}
