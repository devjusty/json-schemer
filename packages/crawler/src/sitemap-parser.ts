import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { SitemapDocument } from "./sitemap-types";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  processEntities: false,
  isArray: (name) => name === "url" || name === "sitemap",
});

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
