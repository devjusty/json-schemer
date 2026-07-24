# Sitemap Schema Scanner Design

## Goal

Build a local web application that scans a website sitemap, extracts JSON-LD structured data from up to 500 pages, displays results in the browser, and exports whole-site or individual-page results for agent review.

## MVP Scope

- Local web app started with one command and opened at `localhost`.
- Single user, no accounts, no hosted tenancy, and no billing.
- One active scan. Starting a new scan replaces the prior scan.
- Site URL discovery by default, with a direct sitemap URL override.
- Sitemap indexes supported.
- Up to 500 same-origin HTTP(S) URLs per scan.
- JSON-LD extraction only. Microdata, RDFa, Open Graph, Twitter Cards, and standard metadata remain future extensions.
- JSON, Markdown, and CSV exports.
- No browser automation or JavaScript execution.

## Architecture

Use one TypeScript workspace with separate application and domain packages:

```text
apps/
  web/
  server/
packages/
  domain/
  crawler/
  extractor/
  storage/
  exporters/
```

- `apps/web`: React + Vite single-page UI for scan setup, progress, results, errors, and exports.
- `apps/server`: Fastify API, scan lifecycle, in-process worker, and Server-Sent Events progress stream.
- `packages/domain`: shared types, status values, settings, and serialized export contracts.
- `packages/crawler`: robots handling, sitemap discovery/parsing, URL normalization, fetching, concurrency, rate limiting, and response classification.
- `packages/extractor`: HTML parsing and JSON-LD block extraction. It preserves raw script text and parsed values without assuming a fixed schema shape.
- `packages/storage`: SQLite schema and repositories for scan, page, JSON-LD block, and schema entity records.
- `packages/exporters`: JSON, Markdown, and CSV serializers derived from stored results.

The crawler and extractor do not depend on HTTP handlers or React. This preserves a path to a future CLI or desktop wrapper without changing scan behavior.

## Tooling Direction

- TypeScript throughout frontend, server, and shared packages.
- React + Vite for the browser client.
- Fastify for the local API.
- SQLite for durable local scan state.
- A typed SQLite access layer in `packages/storage`.
- An in-process async job manager rather than Redis or a distributed queue.
- Server-Sent Events for live progress, with SQLite as the recovery source after reconnects.
- Direct HTTP fetching and HTML parsing; no headless browser in MVP.

Exact package versions and implementation choices belong in the implementation plan after this design is approved.

## Scan Flow

1. User submits a site URL or direct sitemap URL with optional crawl settings.
2. Server creates a scan record and starts the worker.
3. When given a site URL, discovery checks `robots.txt`, then common sitemap locations and sitemap references from robots data. A direct sitemap URL bypasses candidate discovery but still uses crawl policy checks where applicable.
4. Sitemap indexes are followed. Malformed or inaccessible sitemap sources are recorded as discovery errors.
5. URLs are normalized, restricted to the target origin, stripped of fragments, deduplicated, and capped at 500.
6. The fetcher applies bounded concurrency, per-host rate limiting, redirects, timeouts, response-size limits, and content-type checks.
7. Successful HTML responses are passed to the JSON-LD extractor. Every `script[type="application/ld+json"]` block is recorded in document order.
8. The worker persists page and block results as they complete and emits progress events.
9. The scan completes when every queued page has a terminal status.

Default crawl policy is balanced: respect `robots.txt`, stay same-origin, use limited concurrency, and apply a configurable rate limit.

## Data Model

### Scan

Stores target URL, sitemap source, settings, lifecycle status, timestamps, URL counts, success/failure counts, and scan-level errors.

### Page

Stores scan relationship, original and normalized URL, sitemap location, HTTP status, content type, response timing, terminal status, and error details.

Page terminal statuses:

- `success`: HTML fetched and at least one valid JSON-LD block found.
- `no_jsonld`: HTML fetched but no JSON-LD block found.
- `invalid_jsonld`: HTML fetched and JSON-LD blocks were found, but none parsed successfully.
- `http_error`: response returned an HTTP error status.
- `parse_error`: HTML could not be processed as expected before JSON-LD extraction.
- `blocked`: disallowed by robots or scan scope.
- `fetch_error`: timeout, DNS, TLS, connection, redirect, or other request failure.

### JSON-LD Block

Stores page relationship, ordinal position, raw script text, parsed JSON value when valid, and parse error when invalid. Invalid blocks remain visible and exportable.

### Schema Entity

Stores page/block relationship, JSON-LD context, discovered type, and serialized entity summary. It supports filtering and UI display but is not a lossy replacement for the raw block. `@graph`, arrays, and multiple top-level objects must remain representable.

## API and UI Responsibilities

The API must support creating/canceling a scan, reading current scan state, listing pages, reading a page and its JSON-LD blocks, downloading whole-site exports, downloading individual-page exports, and subscribing to progress events.

The UI must provide:

- Scan form with site URL, optional sitemap URL, and balanced-policy settings.
- Scan progress with discovered, queued, completed, successful, and failed counts.
- Page table with URL, status, HTTP status, JSON-LD count, and error indicator.
- Page detail view showing raw blocks, parsed JSON, contexts, types, and parse errors.
- Whole-site and individual-page JSON, Markdown, and CSV downloads.
- Clear distinction between fetch failures, invalid JSON-LD, and pages with no JSON-LD.

## Error Handling and Safety

- Individual sitemap, network, HTTP, HTML, and JSON parse failures are persisted as data and do not crash the complete scan.
- Scan-level failures stop only when no useful work can continue; the UI must expose the reason.
- Accept only HTTP(S) targets.
- Reject localhost and private-network targets by default to reduce SSRF risk.
- Enforce request timeout, response-size, redirect-count, concurrency, and rate-limit bounds.
- Do not execute downloaded JavaScript or persist cookies/authentication credentials.
- Escape Markdown and CSV values. Raw JSON-LD is exported as data in fenced Markdown blocks, never executable markup.

## Export Contracts

JSON is the canonical machine-readable export. It contains scan metadata, settings, page records, raw JSON-LD blocks, normalized schema summaries, and errors.

Markdown is a readable agent-oriented report containing scan summary, per-page status, schema types, errors, and raw JSON-LD in fenced blocks.

CSV is flattened with one row per JSON-LD block/entity and includes page URL, block index, context, type, parse status, and serialized JSON.

All exports are generated on demand from SQLite so browser results and downloaded data share one source of truth. The same formats are available for the whole scan and an individual page.

## Testing Strategy

- Unit tests for URL normalization, sitemap parsing, robots decisions, rate limiting, JSON-LD extraction, status classification, and export escaping.
- Fixture-based integration tests using local HTTP servers for sitemap indexes, malformed XML, redirects, throttling, invalid JSON-LD, duplicate URLs, response limits, and partial failures.
- One end-to-end smoke test covering scan creation, progress updates, result display, and all export formats.

## Future Extension Points

- Additional extractors for Microdata, RDFa, Open Graph, Twitter Cards, and standard metadata.
- Optional rendered-page fetcher for JavaScript-generated JSON-LD.
- Retained scan history and named projects.
- CLI and desktop packaging using the same domain packages.
- Authentication and hosted multi-tenant deployment.

These are explicitly outside MVP and must not add complexity to the initial local runtime.

## Acceptance Criteria

- A user can enter a website URL, discover its sitemap, and scan up to 500 same-origin URLs.
- A user can provide a direct sitemap URL instead of relying on discovery.
- Progress remains visible while pages are processed and recovers after an event-stream reconnect.
- Every JSON-LD block, including invalid blocks, is visible at page level with raw content and parse state.
- Partial failures do not discard successful page results.
- Whole-site and individual-page JSON, Markdown, and CSV exports are downloadable and consistent with displayed data.
- Default safety and crawl controls prevent unbounded requests, cross-origin crawling, local-network targeting, and JavaScript execution.
