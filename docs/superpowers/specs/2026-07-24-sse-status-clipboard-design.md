# SSE Status And Clipboard Design

## Goal

Keep the web UI synchronized with terminal scan status for every discovery
path, including explicit sitemap scans, and let users copy each page's raw
JSON-LD block for audit work.

## Root cause

The server persists terminal status correctly, but SSE `progress` payloads use
`ScanProgress`, which currently contains only counts. `App` merges
`event.progress` into its initial `Scan` object, so the client retains
`queued` even after the server reaches `completed`, `failed`, or `canceled`.
The export API reads persisted status independently, explaining why direct
exports can work while UI export links remain disabled. Explicit sitemap
discovery is not a separate completion bug.

## Design

### Status propagation

Extend shared `ScanProgress` with `status: ScanStatus`. Have
`ScanManager.currentProgress()` read and return the persisted scan status.
Every existing SSE event then carries the authoritative status without adding
another event field or a second status-fetch request. The existing UI merge
updates `scan.status`, enabling exports and hiding the cancel button at the
correct terminal state.

Keep the initial `scan_state` event and all progress event types unchanged.
Update server tests to assert terminal status in emitted progress and retain
the existing persistence assertions.

### Clipboard behavior

In `PageDetail`, render one accessible copy button for each JSON-LD block. The
button calls `navigator.clipboard.writeText(block.rawText)`, preserving exact
source text, including invalid JSON. Use a small local copied indicator so the
user receives confirmation without changing stored data or parsed rendering.
Copy failures must not crash the page; leave the button usable and report no
false success.

Add a focused component test that mocks the clipboard API, clicks a block's
copy button, and verifies the exact raw text. Cover the copied confirmation and
the invalid/raw block case through representative fixture data.

## Files

- Modify `packages/domain/src/index.ts` to add status to `ScanProgress`.
- Modify `apps/server/src/scan/scan-manager.ts` to populate status in progress.
- Add or modify server tests for terminal SSE progress status.
- Modify `apps/web/src/components/PageDetail.tsx` for raw JSON-LD copy controls.
- Add `apps/web/test/PageDetail.test.tsx` for clipboard behavior.
- Update UI types/tests only where TypeScript or regression coverage requires it.

## Boundaries

- Do not add polling or a new status endpoint.
- Do not change explicit sitemap discovery behavior; it already completes and
  persists correctly.
- Do not copy parsed/normalized JSON instead of `rawText`.
- Do not enable exports before a terminal status is received.
- Do not make clipboard support a prerequisite for viewing or exporting data.

## Verification

Run focused server and web tests first, then `pnpm test`, `pnpm typecheck`, and
`pnpm build`. Confirm the regression test fails before implementation and
passes afterward.
