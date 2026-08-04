# DeepWiki Q&A with Code Context for Repository: devjusty/json-schemer
## Q1
if i run this project locally, can my agent perform scans and export the results that it returns?
### Answer
## Answer

Yes. When run locally via `pnpm dev`, JSON Schemer exposes a full HTTP API that an agent can use to start scans, monitor progress, and export results — no UI interaction required.

---

### How an agent would do it

1. **Start a scan**: `POST /api/scans` with a `targetUrl` (and optional `sitemapUrl`/`settings`) triggers `dependencies.manager.start(input)` and returns the scan record json-schemer:98-122 .
2. **Monitor progress**: `GET /api/scans/:scanId/events` streams Server-Sent Events, or the agent can poll `GET /api/scans/active` json-schemer:124-124 json-schemer:156-171 .
3. **Inspect pages**: `GET /api/scans/:scanId/pages` and `GET /api/scans/:scanId/pages/:pageId` return crawled data and JSON-LD detail json-schemer:132-154 .
4. **Export results**: once the scan reaches a terminal state, `GET /api/scans/:scanId/export/:format` (whole-site) or `GET /api/scans/:scanId/pages/:pageId/export/:format` (single page) return JSON, Markdown, or CSV via `handleExport` json-schemer:173-195 json-schemer:78-93 .

These routes are wired up in the server entrypoint, which creates the SQLite database, `ScanManager`, and Fastify app, then listens on `127.0.0.1:4317` json-schemer:10-34 .

### Agent-specific tooling

Beyond raw API access, the project ships a dedicated `json-schema-export-audit` skill specifically meant for agents to review exported JSON/CSV/Markdown for data integrity and Schema.org quality, installable with `npx skills add devjusty/json-schemer` json-schemer:43-56 json-schemer:12-18 .

### Constraints to be aware of

- Exports are only available once a scan reaches a terminal (or canceled) state — attempting to export an active scan returns a `409`-style error via `isNotFoundError`/status handling in `handleExport` json-schemer:39-41 .
- Crawl safety limits (same-origin only, 500 URL cap, no JS execution, robots.txt respected) apply regardless of whether a human or agent triggers the scan json-schemer:58-73 .

## Notes
This confirms the full loop — scan start → progress → page inspection → export — is programmatically accessible over HTTP, so an agent driving the API directly (not just the UI) can perform scans and retrieve results in JSON, Markdown, or CSV form.

Wiki pages you might want to explore:
- [JSON Schemer — Project Overview (devjusty/json-schemer)](/wiki/devjusty/json-schemer#1)
- [Server Application — Fastify API (devjusty/json-schemer)](/wiki/devjusty/json-schemer#3)
### Citations
**File:** apps/server/src/http/routes.ts (L78-93)
```typescript
function handleExport(
  reply: FastifyReply,
  rawFormat: string,
  loadData: (format: ExportFormat) => Parameters<typeof serializeJson>[0],
  basenameFor: (data: Parameters<typeof serializeJson>[0]) => string,
) {
  if (!["json", "markdown", "csv"].includes(rawFormat))
    return reply.code(400).send({ error: "Unsupported export format" });
  try {
    const format = rawFormat as ExportFormat;
    const data = loadData(format);
    return sendExport(reply, format, data, basenameFor(data));
  } catch (error) {
    return reply.code(isNotFoundError(error) ? 404 : 500).send({ error: errorMessage(error) });
  }
}
```
**File:** apps/server/src/http/routes.ts (L98-122)
```typescript
  app.post<{ Body: Record<string, unknown> }>("/api/scans", async (request, reply) => {
    const rawTarget = request.body?.targetUrl;
    if (typeof rawTarget !== "string") return reply.code(400).send({ error: "Target URL must be valid HTTP(S)" });
    let target: URL;
    try {
      target = assertAllowedTarget(rawTarget);
    } catch {
      return reply.code(400).send({ error: "Target URL must be valid HTTP(S)" });
    }

    const rawSitemap = request.body?.sitemapUrl;
    let sitemapUrl: string | null = null;
    if (rawSitemap != null) {
      if (typeof rawSitemap !== "string") return reply.code(400).send({ error: "Sitemap URL must be valid HTTP(S)" });
      try {
        sitemapUrl = assertAllowedTarget(rawSitemap).href;
      } catch {
        return reply.code(400).send({ error: "Sitemap URL must be valid HTTP(S)" });
      }
    }

    const input: ScanInput = { targetUrl: target.href, sitemapUrl, settings: parseSettings(request.body?.settings) };
    const scan = await dependencies.manager.start(input);
    return reply.code(202).send(scan);
  });
```
**File:** apps/server/src/http/routes.ts (L124-124)
```typescript
  app.get("/api/scans/active", async (_request, reply) => reply.send(dependencies.repositories.getActiveScan()));
```
**File:** apps/server/src/http/routes.ts (L132-154)
```typescript
  app.get<{ Params: { scanId: string }; Querystring: { status?: string } }>(
    "/api/scans/:scanId/pages",
    async (request, reply) => {
      if (!dependencies.manager.get(request.params.scanId)) return reply.code(404).send({ error: "Scan not found" });
      return reply.send(
        dependencies.repositories.listPages(
          request.params.scanId,
          request.query.status ? { status: request.query.status as never } : {},
        ),
      );
    },
  );

  app.get<{ Params: { scanId: string; pageId: string } }>(
    "/api/scans/:scanId/pages/:pageId",
    async (request, reply) => {
      try {
        return reply.send(dependencies.repositories.getPageDetail(request.params.scanId, request.params.pageId));
      } catch (error) {
        return reply.code(404).send({ error: errorMessage(error) });
      }
    },
  );
```
**File:** apps/server/src/http/routes.ts (L156-171)
```typescript
  app.get<{ Params: { scanId: string } }>("/api/scans/:scanId/events", async (request, reply) => {
    if (!dependencies.manager.get(request.params.scanId)) return reply.code(404).send({ error: "Scan not found" });
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (event: unknown) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    const unsubscribe = dependencies.manager.subscribe(request.params.scanId, send);
    request.raw.on("close", unsubscribe);
    send({
      type: "scan_state",
      progress: dependencies.manager.currentProgress(request.params.scanId),
    });
  });
```
**File:** apps/server/src/http/routes.ts (L173-195)
```typescript
  app.get<{ Params: { scanId: string; format: string } }>(
    "/api/scans/:scanId/export/:format",
    async (request, reply) => {
      return handleExport(
        reply,
        request.params.format,
        () => dependencies.repositories.getSiteExportData(request.params.scanId),
        (data) => exportBasename(data.scan.targetUrl, "site"),
      );
    },
  );

  app.get<{ Params: { scanId: string; pageId: string; format: string } }>(
    "/api/scans/:scanId/pages/:pageId/export/:format",
    async (request, reply) => {
      return handleExport(
        reply,
        request.params.format,
        () => dependencies.repositories.getPageExportData(request.params.scanId, request.params.pageId),
        (data) => exportBasename(data.scan.targetUrl, "page", "page" in data ? data.page.url : data.pages[0]?.page.url),
      );
    },
  );
```
**File:** apps/server/src/main.ts (L10-34)
```typescript
async function main(): Promise<void> {
  const databasePath = join(process.cwd(), ".data", "scan.db");
  mkdirSync(dirname(databasePath), { recursive: true });
  const repositories = createRepositories(createDatabase(databasePath));
  const manager = new ScanManager({
    repositories,
    discover: (target, sitemapUrl, options) =>
      sitemapUrl
        ? discoverSitemapSources(
            [sitemapUrl],
            (url, redirects) => fetchSitemapText(url, redirects, fetch, options),
            options.maxRedirects,
          )
        : discoverSitemaps(
            target,
            (url, redirects) => fetchSitemapText(url, redirects, fetch, options),
            options.maxRedirects,
          ),
    fetchPage,
    extract: extractJsonLd,
  });
  const app = await createApp({ repositories, manager });
  const port = Number(process.env.PORT ?? 4317);
  await app.listen({ host: "127.0.0.1", port });
  console.log(`JSON Schemer listening at http://127.0.0.1:${port}`);
```
**File:** README.md (L39-41)
```markdown
5. Download whole-site or page-level JSON, Markdown, or CSV exports after the scan reaches a terminal state.

Canceling a scan preserves partial results and makes exports available for the completed portion. Starting another scan replaces the active scan and its stored results.
```
**File:** README.md (L43-56)
```markdown
## Export Audit Skill

Agents can review JSON Schemer exports with the `json-schema-export-audit` skill.
Install the skill collection directly from this repository with:

```bash
npx skills add devjusty/json-schemer
```

The canonical skill definition lives at `skills/json-schema-export-audit/`.
The local `.agents/skills/json-schema-export-audit` path is a symlink to that
directory, so local and public copies stay synchronized. The skill audits JSON,
CSV, and Markdown exports for data integrity and JSON-LD/Schema.org quality,
then produces an evidence-first Markdown report.
```
**File:** README.md (L58-73)
```markdown
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
```
**File:** AGENTS.md (L12-18)
```markdown
## Export Audit Skill

- `json-schema-export-audit` reviews JSON Schemer JSON, CSV, and Markdown exports for export integrity and JSON-LD/Schema.org quality.
- It uses `skills/json-schema-export-audit/references/export-contract.md` for project-specific export shapes and invariants.
- Reports must be findings-first Markdown with severity, category, location, evidence, impact, recommendation, and coverage limits.
- Keep export/data defects separate from schema/site observations; never claim rich-result eligibility from exports alone.
- Install public skill collection with `npx skills add devjusty/json-schemer`.
```
## Q2
are there any improvements we can make to this project to make it more accessible for agentic use?
### Answer
## Answer

Yes — a few concrete gaps in the current implementation limit how easily an agent can drive JSON Schemer end-to-end without a human in the loop.

---

### 1. No machine-readable API schema/OpenAPI spec
The Fastify routes in `apps/server/src/http/routes.ts` are hand-registered with no OpenAPI/JSON-Schema documentation attached json-schemer:98-122 . An agent currently has to rely on README prose (`## API Surface`) rather than a discoverable schema, so adding Fastify's built-in schema validation + `@fastify/swagger` would let agents introspect endpoints, params, and response shapes programmatically instead of guessing from docs.

### 2. Export is blocked while a scan is active, with no wait/poll helper
`handleExport` returns a `409`-style error when a scan hasn't reached a terminal state, as confirmed by the test asserting `"Scan is still active"` json-schemer:17-38 . There's no `/api/scans/:scanId/wait` or long-poll convenience endpoint — an agent must either poll `/api/scans/active` or subscribe to the SSE stream and parse `scan_state` events itself json-schemer:156-171 . A simple "block until terminal" endpoint (or documented polling interval) would reduce agent-side complexity.

### 3. Server-Sent Events require stream-parsing, not simple polling
The event stream implementation writes raw `data: ...` SSE frames over `reply.raw` json-schemer:156-171 . Many agent frameworks handle HTTP request/response better than persistent SSE connections; exposing a lightweight `GET /api/scans/:scanId/status` snapshot endpoint (versus only `/active` and the stream) would make polling-based agents easier to write.

### 4. Export format/contract is defined only in a skill file, not exposed via the API itself
The precise shape/invariants of exports (e.g. CSV header, placeholder rows, block ordinal rules) live in `skills/json-schema-export-audit/references/export-contract.md` json-schemer:1-45 , which is only useful to an agent that has installed the skill via `npx skills add devjusty/json-schemer` json-schemer:43-56 . An agent hitting the raw API without the skill has no way to fetch this contract; exposing it (or a JSON Schema version of it) at a stable endpoint like `/api/export-contract` would make the guarantees available without an extra install step.

### 5. No CLI/non-interactive entrypoint
Per the design doc, the crawler and extractor packages were deliberately kept decoupled from HTTP/React specifically "to preserve a path to a future CLI or desktop wrapper" json-schemer:43-43 , and a CLI is explicitly listed as a "Future Extension Point" not yet built json-schemer:139-144 . Building that CLI (using the same `@schemer/domain`, `@schemer/crawler`, `@schemer/exporters` packages the server already wires together in `apps/server/src/main.ts` json-schemer:10-34 ) would let agents run scans as a single subprocess call without managing an HTTP server/SQLite file/port at all — often simpler for sandboxed agent environments than driving a long-lived Fastify server.

---

## Notes

- These are suggestions inferred from gaps in the current implementation and explicit "future extension" notes in the design doc, not confirmed roadmap items — nothing in `PRODUCT.md`'s "Undecided" section commits to any of this json-schemer:52-56 .
- The `json-schema-export-audit` skill already covers *post-hoc* export auditing well json-schemer:12-18 ; the improvements above are about making the *scan-and-export loop itself* (not just review of finished exports) more agent-friendly.

Wiki pages you might want to explore:
- [JSON Schemer — Project Overview (devjusty/json-schemer)](/wiki/devjusty/json-schemer#1)
- [Export Audit Skill (devjusty/json-schemer)](/wiki/devjusty/json-schemer#6)
### Citations
**File:** apps/server/test/routes.test.ts (L17-38)
```typescript
  it("rejects exports while scan is active", async () => {
    const repositories = createRepositories(createDatabase(":memory:"));
    repositories.replaceActiveScan({
      id: "scan-1",
      targetUrl: "https://example.com",
      sitemapUrl: null,
      settings: DEFAULT_SCAN_SETTINGS,
    });
    repositories.updateScanProgress("scan-1", {
      status: "crawling",
      discovered: 1,
      queued: 1,
      completed: 0,
      successful: 0,
      failed: 0,
    });
    const app = await createApp({ repositories, manager: {} as never });
    const response = await app.inject({ method: "GET", url: "/api/scans/scan-1/export/json" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "Scan is still active" });
    await app.close();
  });
```
**File:** skills/json-schema-export-audit/references/export-contract.md (L1-45)
```markdown
# JSON Schemer Export Contract

Use this reference when auditing exports from `packages/exporters`. Treat it as
the project contract, not as a generic Schema.org validator.

## JSON

`serializeJson` emits one object:

```json
{
  "formatVersion": 1,
  "scan": {},
  "pages": []
}
```

Each `pages[]` entry has:

- `page`: page record with `id`, `scanId`, `url`, `normalizedUrl`, `status`,
  HTTP/content metadata, error, and `createdAt`.
- `blocks`: JSON-LD blocks with `id`, `pageId`, zero-based `ordinal`,
  `rawText`, nullable `parsed`, and nullable `parseError`.
- `entities`: extracted entities with `id`, `blockId`, nullable `context`,
  `types` array, and `serialized` JSON text.

The `scan` object includes `id`, `targetUrl`, optional `sitemapUrl`, settings,
status/timestamps, progress counts (`discovered`, `queued`, `completed`,
`successful`, `failed`), and nullable scan error.

### JSON invariants

- `formatVersion` must be present and currently equal to `1`.
- Every page belongs to the exported scan: `page.scanId === scan.id`.
- Every block belongs to its page: `block.pageId === page.id`.
- Every entity references a block present in the same page.
- Block ordinals should be unique and normally contiguous from `0` within a
  page. Flag gaps or duplicates, but distinguish unusual data from proven
  serializer failure.
- A block with `parseError` should not be treated as valid parsed JSON-LD.
- `parsed` may be `null` when parsing failed; `rawText` remains the evidence.
- Entity `serialized` text should parse as JSON when entity extraction claims it
  is valid.
- Nullable fields such as `sitemapUrl`, `httpStatus`, `contentType`, `error`,
  `context`, and `parseError` are not defects by themselves.
```
**File:** README.md (L43-56)
```markdown
## Export Audit Skill

Agents can review JSON Schemer exports with the `json-schema-export-audit` skill.
Install the skill collection directly from this repository with:

```bash
npx skills add devjusty/json-schemer
```

The canonical skill definition lives at `skills/json-schema-export-audit/`.
The local `.agents/skills/json-schema-export-audit` path is a symlink to that
directory, so local and public copies stay synchronized. The skill audits JSON,
CSV, and Markdown exports for data integrity and JSON-LD/Schema.org quality,
then produces an evidence-first Markdown report.
```
**File:** docs/superpowers/specs/2026-07-24-sitemap-schema-scanner-design.md (L43-43)
```markdown
The crawler and extractor do not depend on HTTP handlers or React. This preserves a path to a future CLI or desktop wrapper without changing scan behavior.
```
**File:** docs/superpowers/specs/2026-07-24-sitemap-schema-scanner-design.md (L139-144)
```markdown
## Future Extension Points

- Additional extractors for Microdata, RDFa, Open Graph, Twitter Cards, and standard metadata.
- Optional rendered-page fetcher for JavaScript-generated JSON-LD.
- Retained scan history and named projects.
- CLI and desktop packaging using the same domain packages.
```
**File:** PRODUCT.md (L52-56)
```markdown
Undecided (early project — deliberately open):

- Brand identity beyond the product name and current UI copy
- Accessibility standard beyond sensible defaults
- Future hosting, multi-user, or cloud persistence models
```
**File:** AGENTS.md (L12-18)
```markdown
## Export Audit Skill

- `json-schema-export-audit` reviews JSON Schemer JSON, CSV, and Markdown exports for export integrity and JSON-LD/Schema.org quality.
- It uses `skills/json-schema-export-audit/references/export-contract.md` for project-specific export shapes and invariants.
- Reports must be findings-first Markdown with severity, category, location, evidence, impact, recommendation, and coverage limits.
- Keep export/data defects separate from schema/site observations; never claim rich-result eligibility from exports alone.
- Install public skill collection with `npx skills add devjusty/json-schemer`.
```

## Additional Questions 

How can we provide better instructions to agents on how to use this? 
If we install the skill in a project, where should we place the exports? 
Does the skill tell the agent where to save the exports and read them?
Do we need to update the ports used and document them?
