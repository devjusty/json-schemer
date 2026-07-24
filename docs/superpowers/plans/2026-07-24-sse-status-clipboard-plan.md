# SSE Status And Clipboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate terminal scan status through SSE and add raw JSON-LD copy controls to page details.

**Architecture:** Extend the existing shared `ScanProgress` event payload with authoritative persisted status, allowing the current `App` state merge to enable exports without polling. Add a local clipboard action per JSON-LD block in `PageDetail`, preserving exact `rawText` and showing transient success only after `writeText` resolves.

**Tech Stack:** TypeScript, React, Vitest, Testing Library, Fastify SSE.

---

### Task 1: Add terminal status to scan progress events

**Files:**
- Modify: `packages/domain/src/index.ts:38-46`
- Modify: `apps/server/src/scan/scan-manager.ts:93-104`
- Test: `apps/server/test/scan-service.test.ts`

- [ ] **Step 1: Write the failing event-status test**

Subscribe before starting a scan, collect emitted events, await `waitForIdle()`, and assert the `scan_completed` event contains `progress.status === "completed"` while the repository still reports completed counts.

Use a one-URL discovery fixture and the existing `extractJsonLd` dependency so the test exercises the real manager event path:

```ts
const events: Array<{ type: string; progress?: { status?: string } }> = [];
const unsubscribe = manager.subscribe("scan-1", (event) => events.push(event));
await manager.start({ targetUrl: "https://example.com", sitemapUrl: "https://example.com/sitemap.xml", settings: DEFAULT_SCAN_SETTINGS });
await manager.waitForIdle();
unsubscribe();

expect(events.at(-1)).toMatchObject({ type: "scan_completed", progress: { status: "completed" } });
```

The test should initially fail at type-check or assertion because `ScanProgress` and `currentProgress()` do not expose status.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `pnpm vitest run apps/server/test/scan-service.test.ts`

Expected: the new assertion fails because the terminal event progress has no `status` property.

- [ ] **Step 3: Extend the shared progress type and manager payload**

Change `ScanProgress` to include `status: ScanStatus`, import `ScanStatus` beside `ScanSettings`, and return the persisted scan status from `currentProgress()`:

```ts
return {
  scanId,
  status: scan.status,
  discovered: scan.discovered,
  queued: scan.queued,
  completed: scan.completed,
  successful: scan.successful,
  failed: scan.failed,
};
```

All existing calls already obtain progress through `currentProgress()`, so scan-state, page-completed, completion, cancellation, and error events carry status consistently.

- [ ] **Step 4: Run the focused server test and verify it passes**

Run: `pnpm vitest run apps/server/test/scan-service.test.ts`

Expected: all scan-manager tests pass, including the new terminal status assertion.

### Task 2: Add raw JSON-LD clipboard controls

**Files:**
- Modify: `apps/web/src/components/PageDetail.tsx:1-47`
- Create: `apps/web/test/PageDetail.test.tsx`

- [ ] **Step 1: Write the failing PageDetail clipboard test**

Render a detail with one valid and one invalid block, mock `navigator.clipboard.writeText`, click the invalid block's accessible copy button, and assert the exact invalid `rawText` is passed and the button reports copied:

```tsx
vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
render(<PageDetail detail={detail} scanId="scan-1" scanStatus="completed" />);
fireEvent.click(screen.getByRole("button", { name: "Copy JSON-LD block 1" }));

expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"broken":');
expect(await screen.findByRole("button", { name: "Copied JSON-LD block 1" })).toBeInTheDocument();
```

The fixture must include required page fields and exact raw text for both blocks. The test should initially fail because no copy buttons exist.

- [ ] **Step 2: Run the focused component test and verify the expected failure**

Run: `pnpm vitest run apps/web/test/PageDetail.test.tsx`

Expected: Testing Library cannot find `Copy JSON-LD block 1`.

- [ ] **Step 3: Implement the minimal clipboard interaction**

Add `useState` for the copied block ID. Render a button adjacent to each block summary or raw-text header with label `Copy JSON-LD block ${block.ordinal}`. On click, call `navigator.clipboard.writeText(block.rawText)`; set copied ID only after success, and clear it after a short timeout. Catch rejected writes without setting copied state. Keep raw and parsed `<pre>` elements unchanged.

- [ ] **Step 4: Run the focused component test and verify it passes**

Run: `pnpm vitest run apps/web/test/PageDetail.test.tsx`

Expected: the clipboard test passes and invalid raw JSON is copied exactly.

### Task 3: Verify UI status synchronization and full suite

**Files:**
- Test: `apps/web/test/App.test.tsx`

- [ ] **Step 1: Add a terminal SSE regression test**

Update the mocked `subscribeToScan` to retain its callback, render the app, start a queued scan, invoke the callback with `{ type: "scan_completed", progress: { status: "completed" } }`, and assert the whole-site JSON link is enabled and the cancel button is absent. Keep the existing queued-state assertion so the test proves the transition.

- [ ] **Step 2: Run the focused web tests**

Run: `pnpm vitest run apps/web/test/App.test.tsx apps/web/test/PageDetail.test.tsx`

Expected: queued state, terminal export enablement, and clipboard behavior all pass.

- [ ] **Step 3: Run repository verification**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected: all tests, strict TypeScript checking, and recursive workspace builds pass.
