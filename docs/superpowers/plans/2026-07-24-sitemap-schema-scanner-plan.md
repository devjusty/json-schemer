# Sitemap Schema Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local TypeScript web app that scans up to 500 same-origin sitemap URLs, extracts every JSON-LD block, displays results, and exports whole-site or page-level JSON, Markdown, and CSV.

**Architecture:** Use a pnpm TypeScript workspace with a React/Vite client and Fastify server. Keep domain types, crawler, extractor, SQLite storage, and exporters in separate packages. Run one in-process scan worker and use Server-Sent Events for progress, with SQLite as the source of truth after reconnects.

**Tech Stack:** TypeScript, pnpm workspaces, React, Vite, Fastify, SQLite with a typed query layer, an HTML parser, an XML parser, native `fetch`, Vitest, and Playwright for the browser smoke test.

---

## File Map

The implementation should create these focused units:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts
playwright.config.ts
apps/server/src/main.ts
apps/server/src/http/routes.ts
apps/server/src/http/sse.ts
apps/server/src/scan/scan-manager.ts
apps/server/src/scan/scan-service.ts
apps/server/test/
apps/web/src/main.tsx
apps/web/src/App.tsx
apps/web/src/api.ts
apps/web/src/components/
apps/web/src/styles.css
apps/web/test/
packages/domain/src/index.ts
packages/crawler/src/url-policy.ts
packages/crawler/src/robots.ts
packages/crawler/src/sitemap.ts
packages/crawler/src/fetcher.ts
packages/crawler/src/index.ts
packages/crawler/test/
packages/extractor/src/jsonld.ts
packages/extractor/src/index.ts
packages/extractor/test/
packages/storage/src/schema.ts
packages/storage/src/repositories.ts
packages/storage/src/database.ts
packages/storage/src/index.ts
packages/storage/test/
packages/exporters/src/json.ts
packages/exporters/src/markdown.ts
packages/exporters/src/csv.ts
packages/exporters/src/index.ts
packages/exporters/test/
tests/fixtures/
tests/e2e/scan.spec.ts
```

## Task 1: Bootstrap Workspace and Domain Contracts

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `packages/domain/package.json`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/test/index.test.ts`

- [ ] **Step 1: Write the failing contract test**

Create a test that imports domain constructors/types and verifies scan settings defaults, terminal statuses, and export scope values:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SCAN_SETTINGS, PAGE_STATUSES } from "../src/index";

describe("domain contracts", () => {
  it("uses balanced crawl defaults", () => {
    expect(DEFAULT_SCAN_SETTINGS).toMatchObject({
      maxUrls: 500,
      concurrency: 4,
      delayMs: 250,
      respectRobots: true,
      sameOriginOnly: true,
    });
  });

  it("defines invalid JSON-LD as a distinct page status", () => {
    expect(PAGE_STATUSES).toContain("invalid_jsonld");
    expect(PAGE_STATUSES).toContain("no_jsonld");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm vitest run packages/domain/test/index.test.ts`

Expected: FAIL because the workspace and domain exports do not exist.

- [ ] **Step 3: Add workspace configuration and contracts**

Define in `packages/domain/src/index.ts`:

```ts
export const PAGE_STATUSES = [
  "success", "no_jsonld", "invalid_jsonld", "http_error",
  "parse_error", "blocked", "fetch_error",
] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export const DEFAULT_SCAN_SETTINGS = {
  maxUrls: 500,
  concurrency: 4,
  delayMs: 250,
  timeoutMs: 15_000,
  maxResponseBytes: 5_000_000,
  maxRedirects: 5,
  respectRobots: true,
  sameOriginOnly: true,
} as const;

export type ScanSettings = typeof DEFAULT_SCAN_SETTINGS;
export type ScanStatus = "queued" | "discovering" | "crawling" | "completed" | "failed" | "canceled";
export type ExportFormat = "json" | "markdown" | "csv";
export type ExportScope = "site" | "page";

export interface ScanProgress {
  scanId: string;
  discovered: number;
  queued: number;
  completed: number;
  successful: number;
  failed: number;
}
```

Configure strict TypeScript, workspace scripts for `test`, `typecheck`, `dev`, `build`, and `lint`, and package aliases for `@schemer/domain`, `@schemer/crawler`, `@schemer/extractor`, `@schemer/storage`, and `@schemer/exporters`.

- [ ] **Step 4: Run the contract test and typecheck**

Run: `pnpm vitest run packages/domain/test/index.test.ts && pnpm typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts packages/domain
git commit -m "chore: bootstrap scanner workspace"
```

## Task 2: Implement Safe URL, Robots, and Sitemap Discovery

**Files:**
- Create: `packages/crawler/package.json`
- Create: `packages/crawler/src/url-policy.ts`
- Create: `packages/crawler/src/robots.ts`
- Create: `packages/crawler/src/sitemap.ts`
- Create: `packages/crawler/src/index.ts`
- Test: `packages/crawler/test/url-policy.test.ts`
- Test: `packages/crawler/test/robots.test.ts`
- Test: `packages/crawler/test/sitemap.test.ts`
- Create: `tests/fixtures/sitemap-index.xml`
- Create: `tests/fixtures/sitemap.xml`

- [ ] **Step 1: Write failing URL policy tests**

Cover HTTPS/HTTP acceptance, localhost/private-network rejection, fragment removal, same-origin enforcement, duplicate normalization, and the 500 URL cap. Use `assertAllowedTarget`, `normalizeUrl`, and `filterSitemapUrls` signatures.

- [ ] **Step 2: Run URL tests and verify failure**

Run: `pnpm vitest run packages/crawler/test/url-policy.test.ts`

Expected: FAIL because policy functions do not exist.

- [ ] **Step 3: Implement URL policy**

`assertAllowedTarget(input: string): URL` must accept only HTTP(S), reject loopback, link-local, RFC1918, IPv6 private, and unspecified addresses, and reject credentials in URLs. `normalizeUrl(input: string, origin: URL): string` must remove fragments, normalize default ports, and enforce same origin. `filterSitemapUrls(urls, origin, maxUrls)` must preserve first-seen order and remove duplicates.

- [ ] **Step 4: Write failing robots and sitemap tests**

Test robots groups, `Sitemap:` directives, allow/disallow precedence, missing robots response, sitemap XML URL sets, sitemap indexes, malformed XML, and deduplication. Use interfaces:

```ts
parseRobots(text: string, userAgent: string): RobotsRules
parseSitemapXml(xml: string): SitemapDocument
discoverSitemaps(siteUrl: URL, fetchText: (url: URL) => Promise<string>): Promise<DiscoveryResult>
```

- [ ] **Step 5: Implement robots and sitemap parsing**

Use an XML parser configured not to resolve external entities. Follow sitemap indexes recursively with a visited set, preserve source URL for each page URL, and return structured discovery errors rather than throwing for one bad source. Apply robots rules to page URLs before queueing.

- [ ] **Step 6: Run crawler unit tests**

Run: `pnpm vitest run packages/crawler/test`

Expected: PASS for URL, robots, sitemap index, malformed XML, and discovery cases.

- [ ] **Step 7: Commit**

```bash
git add packages/crawler tests/fixtures
git commit -m "feat: add safe sitemap discovery"
```

## Task 3: Add HTML Fetching and JSON-LD Extraction

**Files:**
- Create: `packages/crawler/src/fetcher.ts`
- Create: `packages/extractor/package.json`
- Create: `packages/extractor/src/jsonld.ts`
- Create: `packages/extractor/src/index.ts`
- Test: `packages/crawler/test/fetcher.test.ts`
- Test: `packages/extractor/test/jsonld.test.ts`
- Create: `tests/fixtures/page-with-jsonld.html`
- Create: `tests/fixtures/page-invalid-jsonld.html`
- Create: `tests/fixtures/page-no-jsonld.html`

- [ ] **Step 1: Write failing extractor tests**

Assert that `extractJsonLd(html)` returns blocks in document order, preserves exact raw text, parses objects/arrays/`@graph`, records invalid JSON parse errors, and returns `hasValidBlock` plus discovered context/type values without throwing.

- [ ] **Step 2: Run extractor tests and verify failure**

Run: `pnpm vitest run packages/extractor/test/jsonld.test.ts`

Expected: FAIL because `extractJsonLd` is not implemented.

- [ ] **Step 3: Implement JSON-LD extraction**

Parse HTML without executing scripts. For every `script[type="application/ld+json"]`, return:

```ts
interface ExtractedJsonLdBlock {
  ordinal: number;
  rawText: string;
  parsed: unknown | null;
  parseError: string | null;
  entities: Array<{ context: string | null; types: string[]; serialized: string }>;
}
```

Flatten only enough to identify top-level objects, arrays, and `@graph` members. Keep raw and parsed values authoritative.

- [ ] **Step 4: Write failing fetcher tests**

Use a local HTTP test server to cover timeout, response-size limit, redirect limit, non-HTML content type, HTTP errors, and successful HTML response. The function signature is `fetchPage(url, settings, fetchImpl): Promise<FetchResult>`.

- [ ] **Step 5: Implement bounded fetcher**

Use native `fetch` with an abort timeout, bounded redirect handling, content-length and streaming byte checks, no cookies, no JavaScript execution, and response metadata. Return classified results instead of throwing expected request failures.

- [ ] **Step 6: Run crawler and extractor tests**

Run: `pnpm vitest run packages/crawler/test packages/extractor/test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/crawler packages/extractor tests/fixtures
git commit -m "feat: fetch pages and extract JSON-LD"
```

## Task 4: Add SQLite Storage and Export Contracts

**Files:**
- Create: `packages/storage/package.json`
- Create: `packages/storage/src/schema.ts`
- Create: `packages/storage/src/database.ts`
- Create: `packages/storage/src/repositories.ts`
- Create: `packages/storage/src/index.ts`
- Test: `packages/storage/test/repositories.test.ts`

- [ ] **Step 1: Write failing repository tests**

Use an in-memory SQLite database and test creating/replacing the active scan, inserting pages and blocks independently, updating progress, querying page detail, and deleting prior scan data transactionally.

- [ ] **Step 2: Run repository tests and verify failure**

Run: `pnpm vitest run packages/storage/test/repositories.test.ts`

Expected: FAIL because schema and repositories do not exist.

- [ ] **Step 3: Create schema and repository interfaces**

Create tables `scans`, `pages`, `jsonld_blocks`, and `schema_entities` with foreign keys, indexes on scan/page status, and JSON text columns for arbitrary values. Expose repositories:

```ts
createActiveScan(input): ScanRecord
replaceActiveScan(input): ScanRecord
updateScanProgress(scanId, progress): void
upsertPage(input): PageRecord
insertJsonLdBlock(input): void
insertSchemaEntity(input): void
getActiveScan(): ScanRecord | null
listPages(scanId, filters): PageRecord[]
getPageDetail(scanId, pageId): PageDetail
getSiteExportData(scanId): SiteExportData
getPageExportData(scanId, pageId): PageExportData
```

- [ ] **Step 4: Implement transaction boundaries**

Wrap replacement and scan initialization in one transaction. Persist each page result and its blocks/entities in one transaction. Ensure a process restart can read the last persisted scan state.

- [ ] **Step 5: Run storage tests**

Run: `pnpm vitest run packages/storage/test/repositories.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/storage
git commit -m "feat: persist scan results in SQLite"
```

## Task 5: Implement Exporters

**Files:**
- Create: `packages/exporters/package.json`
- Create: `packages/exporters/src/json.ts`
- Create: `packages/exporters/src/markdown.ts`
- Create: `packages/exporters/src/csv.ts`
- Create: `packages/exporters/src/index.ts`
- Test: `packages/exporters/test/exporters.test.ts`

- [ ] **Step 1: Write failing export tests**

Build a representative `SiteExportData` fixture containing valid, invalid, array, and `@graph` blocks plus quotes, commas, newlines, and Markdown metacharacters. Assert whole-site and page-level output for all formats, stable JSON shape, CSV headers, CSV escaping, Markdown fenced raw blocks, and no executable HTML.

- [ ] **Step 2: Run export tests and verify failure**

Run: `pnpm vitest run packages/exporters/test/exporters.test.ts`

Expected: FAIL because serializers do not exist.

- [ ] **Step 3: Implement canonical JSON export**

`serializeJson(data, scope)` must emit formatted JSON containing `formatVersion`, scan metadata, page records, raw blocks, entity summaries, and errors. Individual-page output uses the same shape with one page and preserves its scan metadata.

- [ ] **Step 4: Implement Markdown export**

Escape headings and table cells, render status/error summaries, and place every raw JSON-LD block inside a fenced `json` block. Never interpolate raw data into HTML.

- [ ] **Step 5: Implement CSV export**

Emit one row per schema entity when entities exist and one row per raw block otherwise. Include `page_url`, `block_index`, `context`, `type`, `parse_status`, and `serialized_json`. Quote fields containing commas, quotes, or line breaks.

- [ ] **Step 6: Run exporter tests**

Run: `pnpm vitest run packages/exporters/test/exporters.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/exporters
git commit -m "feat: add agent-friendly exports"
```

## Task 6: Build Scan Service, API, and Progress Stream

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/src/scan/scan-service.ts`
- Create: `apps/server/src/scan/scan-manager.ts`
- Create: `apps/server/src/http/routes.ts`
- Create: `apps/server/src/http/sse.ts`
- Create: `apps/server/src/main.ts`
- Test: `apps/server/test/scan-service.test.ts`
- Test: `apps/server/test/routes.test.ts`

- [ ] **Step 1: Write failing scan-service tests**

Stub crawler, extractor, and storage ports. Assert URL discovery, 500 URL cap, bounded worker concurrency, page persistence after each result, status mapping including `invalid_jsonld`, cancellation, completion, and replacement of the prior scan.

- [ ] **Step 2: Run service tests and verify failure**

Run: `pnpm vitest run apps/server/test/scan-service.test.ts`

Expected: FAIL because scan service and manager do not exist.

- [ ] **Step 3: Implement scan service and manager**

Define ports so orchestration is testable without network access. `ScanManager.start(input)` replaces active state, launches one worker, and exposes `get(scanId)`, `cancel(scanId)`, and `subscribe(scanId)`. Publish progress after discovery and every persisted page.

- [ ] **Step 4: Add HTTP route tests**

Cover:

```text
POST /api/scans
GET  /api/scans/active
POST /api/scans/:scanId/cancel
GET  /api/scans/:scanId/pages
GET  /api/scans/:scanId/pages/:pageId
GET  /api/scans/:scanId/events
GET  /api/scans/:scanId/export/:format
GET  /api/scans/:scanId/pages/:pageId/export/:format
```

Assert validation errors for malformed URLs, format negotiation, content-disposition filenames, and SSE reconnect behavior based on current stored state.

- [ ] **Step 5: Implement Fastify routes and SSE**

Validate request bodies at the boundary, map domain errors to stable JSON error responses, set export content types, and keep SSE events small: `scan_state`, `progress`, `page_completed`, `scan_completed`, and `scan_error`. On connection, send current state before subscribing to future events.

- [ ] **Step 6: Add server entrypoint and local scripts**

Start SQLite, repositories, scan manager, Fastify, and static web serving in production mode. In development, expose a configured API port and Vite dev server with proxying. Bind only to loopback by default.

- [ ] **Step 7: Run server tests and typecheck**

Run: `pnpm vitest run apps/server/test && pnpm typecheck`

Expected: PASS with no type errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server
git commit -m "feat: add scan API and progress events"
```

## Task 7: Build React Results Interface

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/api.ts`
- Create: `apps/web/src/components/ScanForm.tsx`
- Create: `apps/web/src/components/ProgressPanel.tsx`
- Create: `apps/web/src/components/PageTable.tsx`
- Create: `apps/web/src/components/PageDetail.tsx`
- Create: `apps/web/src/styles.css`
- Test: `apps/web/test/App.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Mock API calls and assert the form supports site URL plus optional sitemap URL, progress renders counts, page statuses distinguish `invalid_jsonld`/`no_jsonld`/fetch errors, page detail displays raw and parsed blocks, and export links exist for site and page scopes.

- [ ] **Step 2: Run UI tests and verify failure**

Run: `pnpm vitest run apps/web/test/App.test.tsx`

Expected: FAIL because the React app does not exist.

- [ ] **Step 3: Implement API client and scan form**

Create typed `createScan`, `getActiveScan`, `listPages`, `getPageDetail`, `cancelScan`, and `subscribeToScan` functions. Disable duplicate submission while a scan is active and show validation/server errors inline.

- [ ] **Step 4: Implement progress and results components**

Render live SSE state, reconnect using current scan state, page filtering by terminal status, sortable URL/status columns, and page detail with collapsible raw JSON-LD blocks and parse errors. Keep raw JSON in `<pre>` text content; do not use unsafe HTML injection.

- [ ] **Step 5: Implement export controls and responsive styling**

Provide whole-site JSON/Markdown/CSV links in the scan header and page-level links in detail view. Use accessible controls, keyboard-visible focus, responsive table/detail layout, and readable long-JSON wrapping.

- [ ] **Step 6: Run UI tests and typecheck**

Run: `pnpm vitest run apps/web/test/App.test.tsx && pnpm typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: add scan results interface"
```

## Task 8: Add End-to-End Verification and Runbook

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/scan.spec.ts`
- Create: `tests/fixtures/site/robots.txt`
- Create: `tests/fixtures/site/sitemap.xml`
- Create: `tests/fixtures/site/index.html`
- Create: `tests/fixtures/site/product.html`
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Create deterministic fixture server**

Serve fixture robots, sitemap, HTML, invalid JSON-LD, duplicate URL, redirect, and failing endpoint on a local test port. Ensure fixture data never requires external network access.

- [ ] **Step 2: Write the failing browser smoke test**

Test that a user enters the fixture site, starts a scan, observes progress, sees page statuses and extracted schema types, opens page detail, and downloads JSON, Markdown, and CSV site exports. Assert the invalid JSON-LD page remains visible with its parse error.

- [ ] **Step 3: Run the smoke test and verify failure**

Run: `pnpm playwright test tests/e2e/scan.spec.ts`

Expected: FAIL until server startup, UI wiring, and export routes are complete.

- [ ] **Step 4: Wire test startup and production build**

Configure Playwright `webServer` to start the local app against the fixture server. Add `pnpm build`, `pnpm start`, `pnpm test:e2e`, and `pnpm verify` scripts. `verify` must run unit tests, typecheck, build, and E2E tests in that order.

- [ ] **Step 5: Document local operation**

README must include prerequisites, install command, development command, production command, SQLite data location, scan limits/defaults, safety restrictions, export behavior, and test commands.

- [ ] **Step 6: Run full verification**

Run: `pnpm verify`

Expected: unit/integration tests PASS, typecheck PASS, production build PASS, and browser smoke test PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json playwright.config.ts tests/e2e tests/fixtures/site README.md
git commit -m "test: verify scanner end to end"
```

## Plan Self-Review

- Spec coverage: local-only operation, one active scan, URL/sitemap entrypoints, sitemap indexes, 500 URL cap, JSON-LD-only extraction, balanced crawl policy, SQLite persistence, SSE reconnect, page-level statuses, safety limits, three export formats, future parser boundary, unit/integration/E2E tests, and responsive UI are covered by Tasks 1-8.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation steps remain.
- Type consistency: domain statuses and settings are defined in Task 1; crawler, extractor, storage, exporter, service, API, and UI tasks consume those names consistently.
- Scope check: all work belongs to the single approved local scanner subsystem. History, auth, browser rendering, additional structured-data formats, and hosted deployment remain excluded.
