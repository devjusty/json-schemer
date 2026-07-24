export type SitemapDocument = { kind: "urlset"; urls: string[] } | { kind: "index"; sitemaps: string[] };

export interface DiscoveredSitemapUrl {
  url: string;
  source: string;
}

export interface DiscoveryResult {
  urls: DiscoveredSitemapUrl[];
  errors: Array<{ source: string; message: string }>;
}
