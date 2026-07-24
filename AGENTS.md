# Repository Instructions

## Layout

- pnpm workspace uses `apps/*` and `packages/*`.
- `apps/server` is the Fastify API and scan runtime; `apps/web` is the Vite/React UI.
- `packages/crawler` handles sitemap discovery, robots rules, fetching, and URL safety.
- `packages/extractor` parses JSON-LD; `packages/storage` owns SQLite schema/repositories; `packages/domain` owns shared types/default settings; `packages/exporters` serializes scan data.
- Public agent skill lives at `skills/json-schema-export-audit/`; local discovery path `.agents/skills/json-schema-export-audit` is a symlink to it. Edit only the canonical `skills/` copy.
- Workspace package entrypoints are each package's `src/index.ts`; server entrypoint is `apps/server/src/main.ts`; web entrypoint is `apps/web/src/main.tsx`.

## Export Audit Skill

- `json-schema-export-audit` reviews JSON Schemer JSON, CSV, and Markdown exports for export integrity and JSON-LD/Schema.org quality.
- It uses `skills/json-schema-export-audit/references/export-contract.md` for project-specific export shapes and invariants.
- Reports must be findings-first Markdown with severity, category, location, evidence, impact, recommendation, and coverage limits.
- Keep export/data defects separate from schema/site observations; never claim rich-result eligibility from exports alone.
- Install public skill collection with `npx skills add devjusty/json-schemer`.

## Commands

- Requirements: Node.js 24+ and pnpm 10+ (`pnpm@10.33.3`).
- Install and run locally with `pnpm install` then `pnpm dev`; API listens on `127.0.0.1:4317`, UI on `127.0.0.1:5173`.
- Run focused tests with `pnpm vitest run path/to/file.test.ts` or `pnpm test:ui`; run E2E with `pnpm test:e2e`.
- Use `pnpm check:ci` for CI-safe Biome validation, `pnpm typecheck` for strict no-emit TypeScript checking, and `pnpm build` for recursive workspace builds.
- Full verification order is `pnpm check:ci && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` (`pnpm verify`).
- `pnpm dev` starts server and web together; Playwright starts only `@schemer/web` and expects the API to be mocked by tests or already running.

## Runtime Constraints

- Server creates `.data/scan.db` relative to current working directory and initializes schema on startup; tests use `:memory:` SQLite databases.
- Starting a scan replaces previous scan data. Default scan settings enforce same-origin URLs, `robots.txt`, bounded concurrency/rate limits, and a 500-URL cap.
- Crawler rejects HTTP(S) targets resolving to local/private networks and never executes downloaded JavaScript. Preserve these checks when changing discovery or fetching.
- API and UI communicate through `/api`; Vite proxies that path to `http://127.0.0.1:4317`. Scan progress uses Server-Sent Events at `/api/scans/:scanId/events`.

## Files And Generated Output

- Test fixtures live in `tests/fixtures/`; E2E specs live in `tests/e2e/`; unit tests sit beside their owning app/package in `test/`.
- Do not commit `.data`, `dist`, `playwright-report`, `test-results`, `.worktrees`, or database files; these paths are ignored and excluded from Biome/Fallow analysis.
- Fallow entrypoints are `apps/*/src/main.{ts,tsx}` and `packages/*/src/index.{ts,tsx}`. CI treats dead-code, dependency, and import-graph regressions as blocking; complexity, duplication, and styling findings are advisory.
