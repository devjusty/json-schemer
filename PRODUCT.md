# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SEO specialists, engineers, and agents audit or improve a site's JSON-LD / Schema.org markup. You run it on your machine against a public site or a known sitemap. You need page-level proof of the structured data, and you may pass exports to another person or agent.

Secondary audiences are marketers and managers who consume scan results or exports rather than running the crawl themselves.

## Product Purpose

JSON Schemer is a local sitemap scanner for JSON-LD structured data. It discovers sitemap URLs, fetches pages, extracts JSON-LD blocks and Schema.org entities, presents page-level results in a local web UI, and exports site or page evidence as JSON, Markdown, or CSV so humans or agents can audit and improve schemas.

You start from a website or sitemap URL, watch a bounded crawl finish, inspect each page, and leave with export files. Crawl data stays on your machine.

## Positioning

JSON Schemer runs on your machine, stores results in local SQLite, skips downloaded JavaScript, stays same-origin and robots-bounded, and writes exports humans and agents can audit.

## Operating Context

- Run locally via `pnpm dev` (API on `127.0.0.1:4317`, UI on `127.0.0.1:5173`).
- Enter a website URL; optionally override with a direct sitemap URL.
- Monitor discovery and crawl progress over Server-Sent Events; cancel preserves partial results.
- Inspect pages for status, HTTP metadata, JSON-LD blocks, parse errors, and entities.
- Export whole-site or page-level JSON, Markdown, or CSV after a terminal (or cancelled) state.
- Agents may review exports with the public `json-schema-export-audit` skill (`npx skills add devjusty/json-schemer`).
- Starting a new scan replaces previous scan data in `.data/scan.db`.

## Capabilities and Constraints

Confirmed capabilities:

- Sitemap discovery from `robots.txt` or a supplied sitemap URL
- Page-level JSON-LD extraction and Schema.org entity presentation
- Live scan progress and cancel
- Site and page exports: `json`, `markdown`, `csv`
- Local SQLite persistence

Hard constraints to preserve:

- HTTP(S) only; reject loopback/private/link-local/unique-local/unspecified/CGNAT targets
- Never execute downloaded JavaScript
- Default: same-origin only, `robots.txt` enforced, max 500 URLs, bounded concurrency/rate limits
- Scan data stays on the local machine

Undecided:

- Brand identity beyond the product name and current UI copy
- Accessibility standard beyond sensible defaults
- Future hosting, multi-user, or cloud persistence models

## Brand Commitments

Product name: **JSON Schemer**. Early-stage; no binding logo, voice, or visual identity beyond what exists in the repo today. Future design work may evolve branding freely unless new commitments are recorded here.

## Evidence on Hand

- Working local app: scan form, progress, page table/detail, export bar (`apps/web`)
- README product description and safety/limits documentation
- Export audit skill and contract under `skills/json-schema-export-audit/`
- Test fixtures and E2E specs under `tests/`

Do not fabricate testimonials, customer names, benchmarks, pricing, or rich-result eligibility claims from exports alone.

## Product Principles

1. Show what the crawl extracted. Leave Google eligibility to a validator on the live page.
2. Keep data on the machine. Respect robots, origin, and the URL cap.
3. Ship a UI for people and exports for agents.
4. Product truth outranks any temporary visual system while the project is young.
5. One active scan. Cancel keeps partial results. A new scan replaces the old one.
