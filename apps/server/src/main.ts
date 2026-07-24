import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { discoverSitemaps, fetchPage, parseSitemapXml } from "@schemer/crawler";
import { extractJsonLd } from "@schemer/extractor";
import { createDatabase, createRepositories } from "@schemer/storage";
import { createApp } from "./http/routes";
import { ScanManager } from "./scan/scan-manager";

async function fetchText(url: URL): Promise<string> {
  const response = await fetch(url, { redirect: "follow", headers: { accept: "application/xml,text/plain" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function discoverDirect(sitemapUrl: string) {
  const queue = [sitemapUrl];
  const visited = new Set<string>();
  const urls: Array<{ url: string; source: string }> = [];
  const errors: Array<{ source: string; message: string }> = [];
  while (queue.length) {
    const source = queue.shift();
    if (!source) break;
    if (visited.has(source)) continue;
    visited.add(source);
    try {
      const document = parseSitemapXml(await fetchText(new URL(source)));
      if (document.kind === "index") queue.push(...document.sitemaps);
      else urls.push(...document.urls.map((url) => ({ url, source })));
    } catch (error) {
      errors.push({ source, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { urls, errors };
}

async function main(): Promise<void> {
  const databasePath = join(process.cwd(), ".data", "scan.db");
  mkdirSync(dirname(databasePath), { recursive: true });
  const repositories = createRepositories(createDatabase(databasePath));
  const manager = new ScanManager({
    repositories,
    discover: (target, sitemapUrl) => (sitemapUrl ? discoverDirect(sitemapUrl) : discoverSitemaps(target, fetchText)),
    fetchPage,
    extract: extractJsonLd,
  });
  const app = await createApp({ repositories, manager });
  const port = Number(process.env.PORT ?? 4317);
  await app.listen({ host: "127.0.0.1", port });
  console.log(`Jason Schemer listening at http://127.0.0.1:${port}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
