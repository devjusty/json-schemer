import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { discoverSitemapSources, discoverSitemaps, fetchPage } from "@schemer/crawler";
import { extractJsonLd } from "@schemer/extractor";
import { createDatabase, createRepositories } from "@schemer/storage";
import { createApp } from "./http/routes";
import { ScanManager } from "./scan/scan-manager";
import { fetchSitemapText } from "./scan/sitemap-fetcher";

async function main(): Promise<void> {
  const databasePath = join(process.cwd(), ".data", "scan.db");
  mkdirSync(dirname(databasePath), { recursive: true });
  const repositories = createRepositories(createDatabase(databasePath));
  const manager = new ScanManager({
    repositories,
    discover: (target, sitemapUrl, options) =>
      sitemapUrl
        ? discoverSitemapSources(
            [sitemapUrl],
            (url, redirects) => fetchSitemapText(url, redirects, fetch, options),
            options.maxRedirects,
          )
        : discoverSitemaps(
            target,
            (url, redirects) => fetchSitemapText(url, redirects, fetch, options),
            options.maxRedirects,
          ),
    fetchPage,
    extract: extractJsonLd,
  });
  const app = await createApp({ repositories, manager });
  const port = Number(process.env.PORT ?? 4317);
  await app.listen({ host: "127.0.0.1", port });
  console.log(`JSON Schemer listening at http://127.0.0.1:${port}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
