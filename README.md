# Jason Schemer

Local sitemap scanner for JSON-LD structured data.

## Prerequisites

- Node.js 24+
- pnpm 10+

## Run

```bash
pnpm install
pnpm dev
```

The command starts API server on `http://127.0.0.1:4317` and opens Vite UI on `http://127.0.0.1:5173`.

SQLite data lives at `.data/scan.db`. Starting a scan replaces previous scan data. MVP caps scans at 500 same-origin URLs, respects `robots.txt`, uses bounded concurrency/rate limits, rejects local/private targets, and never executes downloaded JavaScript.

Enter website URL for sitemap discovery or provide direct sitemap URL override. Results support whole-site and page-level JSON, Markdown, and CSV downloads.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
pnpm verify
```

Fixture data used by crawler tests lives in `tests/fixtures/`.
