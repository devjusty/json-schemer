# Refactor Priority Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce high-risk complexity while preserving scanner behavior and improving direct test seams.

**Architecture:** Move sitemap traversal into the crawler package, isolate page fetch/extract/persist work from scan orchestration, split response classification from redirect control, and decompose the web app into a session hook plus focused presentation components. Keep robots behavior unchanged while separating document parsing from policy matching.

**Tech Stack:** TypeScript, Fastify, React, Vitest, pnpm, Fallow.

---

### Task 1: Unify Sitemap Discovery

**Files:**
- Create: `packages/crawler/src/sitemap-discovery.ts`
- Modify: `packages/crawler/src/sitemap.ts`
- Modify: `packages/crawler/src/index.ts`
- Modify: `apps/server/src/main.ts`
- Test: `packages/crawler/test/sitemap.test.ts`

- [ ] Add `discoverSitemapSources(sources, fetchText)` using one queue, visited set, URL-set expansion, nested-index traversal, and per-source errors.
- [ ] Refactor `discoverSitemaps` to use shared traversal after adding automatic and robots-declared sources.
- [ ] Add tests for direct URL sets, nested indexes, cycles, duplicate sources, and source errors.
- [ ] Replace `discoverDirect` in `main.ts` with `discoverSitemapSources([sitemapUrl], fetchText)`.
- [ ] Run `pnpm vitest run packages/crawler/test/sitemap.test.ts apps/server/test/scan-service.test.ts` and `pnpm typecheck`.

### Task 2: Isolate Page Processing

**Files:**
- Create: `apps/server/src/scan/page-processor.ts`
- Create: `apps/server/test/page-processor.test.ts`
- Modify: `apps/server/src/scan/scan-manager.ts`
- Modify: `apps/server/test/scan-service.test.ts`

- [ ] Define processor dependencies for repositories, `fetchPage`, `extract`, and injectable ID creation.
- [ ] Move fetch, JSON-LD classification, page persistence, and block/entity persistence into `processPage`.
- [ ] Return page status and success information to `ScanManager`; keep counters, cancellation, and event publication in the manager.
- [ ] Add tests for successful JSON-LD, no JSON-LD, invalid JSON-LD, extractor failure, HTTP failure, and persisted relationships.
- [ ] Run focused server tests and `pnpm typecheck`.

### Task 3: Split Fetch Response Classification

**Files:**
- Create: `packages/crawler/src/fetcher-response.ts`
- Modify: `packages/crawler/src/fetcher.ts`
- Test: `packages/crawler/test/fetcher.test.ts`

- [ ] Extract content-type normalization, status classification, declared-length checks, body byte checks, and body reading into pure/testable helpers.
- [ ] Keep redirect traversal, timeout lifecycle, and public `FetchResult` contract in `fetcher.ts`.
- [ ] Add tests for relative redirects, redirect limits, missing locations, timeout/network errors, missing content type, declared/actual size limits, exact boundaries, and 3xx/4xx responses.
- [ ] Run crawler tests and `pnpm typecheck`.

### Task 4: Separate Robots Parsing Responsibilities

**Files:**
- Modify: `packages/crawler/src/robots.ts`
- Test: `packages/crawler/test/robots.test.ts`

- [ ] Extract document scanning into `parseRobotsDocument` and policy selection/matching into `createRobotsMatcher`, retaining `parseRobots` as the public facade.
- [ ] Preserve current wildcard-agent, longest-path, sitemap-deduplication, and empty-file behavior.
- [ ] Add tests for agent precedence, multiple groups, comments/whitespace, duplicate sitemaps, empty directives, malformed lines, and path matching.
- [ ] Do not activate currently unused `respectRobots` behavior in this refactor.
- [ ] Run crawler tests and `pnpm typecheck`.

### Task 5: Decompose Web App Orchestration

**Files:**
- Create: `apps/web/src/hooks/useScanSession.ts`
- Create: `apps/web/src/components/ExportBar.tsx`
- Create: `apps/web/src/components/ScanWorkspace.tsx`
- Create: `apps/web/src/components/PageResults.tsx`
- Create: `apps/web/test/useScanSession.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/test/App.test.tsx`
- Modify: `apps/web/src/components/PageTable.tsx`

- [ ] Move active-scan hydration, scan lifecycle, page/detail loading, SSE subscription, errors, and busy state into `useScanSession`.
- [ ] Move whole-site export gating and cancellation into `ExportBar`.
- [ ] Move progress/export/results composition into `ScanWorkspace` and page table/detail selection into `PageResults`.
- [ ] Keep `App` as composition root with setup form, global error banner, empty state, and workspace.
- [ ] Add hook tests for hydration, SSE cleanup, page refresh, detail errors, scan creation errors, cancellation errors, and stale selection responses.
- [ ] Preserve existing terminal export regression tests and add explicit composition tests for the extracted components.
- [ ] Fix nested row/button click propagation in `PageTable` without changing selection behavior.
- [ ] Run web tests and `pnpm typecheck`.

### Task 6: Verify Refactor Outcomes

**Files:**
- Verify all files above; do not change Fallow configuration or add suppressions.

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm check:ci`.
- [ ] Run `fallow health --format json --quiet --explain --hotspots --targets --score --ownership --top 20 || true`.
- [ ] Run `fallow dupes --format json --quiet --explain || true`.
- [ ] Confirm `discoverDirect` is removed, `App.tsx` is composition-focused, no duplicate groups were introduced, and all prior behavior tests pass.
