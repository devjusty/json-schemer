# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are SEO specialists, engineers, and agents auditing or improving a site's JSON-LD / Schema.org markup. They typically work from a local machine against a public site (or a known sitemap), need page-level evidence of what structured data is present, and may hand exports to humans or other agents for further review.

Secondary audiences are marketers and managers who consume scan results or exports rather than running the crawl themselves.

## Product Purpose

JSON Schemer is a local sitemap scanner for JSON-LD structured data. It discovers sitemap URLs, fetches pages, extracts JSON-LD blocks and Schema.org entities, presents page-level results in a local web UI, and exports site or page evidence as JSON, Markdown, or CSV so humans or agents can audit and improve schemas.

Success means: a user (or agent) can start from a website or sitemap URL, watch a bounded crawl complete, inspect what was found per page, and leave with trustworthy export artifacts without sending crawl data to a third-party hosted SEO product.

## Positioning

Local-first, crawl-safe evidence for humans and agents — not a hosted SEO suite. Neighboring cloud SEO or schema tools cannot truthfully claim the same combination of on-machine SQLite storage, no downloaded JavaScript execution, same-origin/robots-bounded crawling, and exports shaped for both human review and agent audit skills.

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

Undecided (early project — deliberately open):

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

1. Evidence over opinion — show what was crawled and extracted; do not claim search eligibility from local exports alone.
2. Local and bounded — keep data on-machine; respect robots, origin, and crawl safety limits.
3. Dual audience — UI for specialists and engineers; exports and skills for agents.
4. Replaceable early identity — product truth outranks any temporary visual system while the project is young.
5. Honest scope — one active scan, clear cancel/replace semantics, no invented social proof.
