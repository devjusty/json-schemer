# Jason Schemer

Local sitemap scanner for JSON-LD structured data. Scan a website and export information about its schemas so humans or agents can audit and improve them.

Jason Schemer discovers sitemap URLs, fetches pages, extracts JSON-LD blocks and Schema.org entities, and presents page-level results in a local web UI.

## Features

- Discover sitemaps from `robots.txt` or scan a supplied sitemap URL directly.
- Inspect page status, HTTP metadata, JSON-LD blocks, parse errors, and extracted entities.
- Watch scan progress over Server-Sent Events and cancel an active scan.
- Export whole-site or page-level results as JSON, Markdown, or CSV.
- Keep scan data locally in SQLite.

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 10+

### Run

```bash
pnpm install
pnpm dev
```

The command starts API server on `http://127.0.0.1:4317` and opens Vite UI on `http://127.0.0.1:5173`.

SQLite data lives at `.data/scan.db`. Starting a scan replaces previous scan data. MVP caps scans at 500 same-origin URLs, respects `robots.txt`, uses bounded concurrency/rate limits, rejects local/private targets, and never executes downloaded JavaScript.

## Using The Scanner

1. Enter a website URL. The scanner uses the site's `robots.txt` and sitemap references for discovery.
2. Optionally enter a direct sitemap URL to override automatic sitemap discovery.
3. Start the scan and monitor discovery, crawl progress, successful pages, and failures in the UI.
4. Open a page to inspect its JSON-LD blocks and Schema.org entities.
5. Download whole-site or page-level JSON, Markdown, or CSV exports after the scan reaches a terminal state.

Canceling a scan preserves partial results and makes exports available for the completed portion. Starting another scan replaces the active scan and its stored results.

## Safety And Limits

The crawler only accepts HTTP(S) targets and rejects targets that resolve to loopback, private, link-local, unique-local, unspecified, or carrier-grade NAT networks. It does not execute JavaScript from downloaded pages.

Default scan settings are:

- 500 maximum URLs
- 4 concurrent page fetches
- 250 ms request delay
- 15 second request timeout
- 5 MB maximum response body
- 5 redirects maximum
- `robots.txt` enforcement enabled
- Same-origin URLs only

The API validates scan settings within bounded ranges. These protections should remain in place when changing crawler discovery or fetching behavior.

## API Surface

The local API is served from `/api`:

- `POST /api/scans` starts a scan.
- `GET /api/scans/active` returns the active scan, if one exists.
- `POST /api/scans/:scanId/cancel` cancels a scan.
- `GET /api/scans/:scanId/events` streams progress as Server-Sent Events.
- `GET /api/scans/:scanId/pages` lists scanned pages.
- `GET /api/scans/:scanId/pages/:pageId` returns page details and extracted data.
- `GET /api/scans/:scanId/export/:format` exports site results.
- `GET /api/scans/:scanId/pages/:pageId/export/:format` exports page results.

Supported export formats are `json`, `markdown`, and `csv`. The Vite development server proxies `/api` to the API at `http://127.0.0.1:4317`.

## Project Structure

```text
apps/server/       Fastify API, scan orchestration, and SQLite startup
apps/web/          Vite/React user interface
packages/crawler/  Sitemap discovery, robots rules, fetching, and URL policy
packages/extractor JSON-LD parsing
packages/storage   SQLite schema and repositories
packages/domain    Shared types and default scan settings
packages/exporters Site and page export serializers
tests/fixtures/    HTML and sitemap fixtures used by crawler tests
tests/e2e/         Playwright browser tests
```

Workspace package entrypoints are `packages/*/src/index.ts`. The application entrypoints are `apps/server/src/main.ts` and `apps/web/src/main.tsx`.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm verify
```

Use a focused test command while iterating:

```bash
pnpm vitest run packages/crawler/test/url-policy.test.ts
pnpm test:ui
```

Playwright starts only the web development server. E2E tests mock API requests, so they do not require the Fastify server to be running. Run the full suite with `pnpm test:e2e`.

`pnpm verify` runs the full verification sequence: Biome CI checks, strict TypeScript checking, unit tests, workspace builds, and E2E tests.

## Code Quality

Biome formats JavaScript, TypeScript, JSX, TSX, JSON, and CSS. Fallow checks workspace reachability, unused code and dependencies, complexity, duplication, and changed-code risk.

```bash
pnpm format       # format and organize imports
pnpm check:ci     # CI-safe Biome check
pnpm fallow       # full Fallow analysis as JSON
pnpm fallow:audit # changed-code audit against main
pnpm fallow:review # non-blocking changed-code review brief
pnpm quality      # Biome, typecheck, and tests
```

CI blocks Fallow dead-code, dependency, and import-graph regressions. Complexity, duplication, and styling findings are advisory until refactoring policy is established. Fallow telemetry remains disabled. Do not add generated `.data`, `dist`, Playwright, or worktree output to commits.

## Architecture

The server creates the SQLite database, wires crawler and extractor dependencies into `ScanManager`, and exposes the scan API through Fastify. The web app talks to that API through relative `/api` requests. Scan events are streamed over Server-Sent Events so the UI can update without polling.

The workspace packages keep responsibilities separate:

- `@schemer/crawler` discovers and fetches URLs while enforcing robots and URL safety rules.
- `@schemer/extractor` parses JSON-LD from fetched HTML.
- `@schemer/storage` persists scans, pages, blocks, and entities.
- `@schemer/domain` defines shared statuses, settings, and export types.
- `@schemer/exporters` serializes stored results.

Keep crawler network protections intact when changing discovery or fetching. Keep database access behind the storage repositories when changing persistence or API behavior.
