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

## CSV

The exact header is:

```text
page_url,block_index,context,type,parse_status,serialized_json
```

Rows are produced per block:

- If a block has entities, emit one row per entity.
- If a block has no entities, emit one row containing its `rawText` in
  `serialized_json`.
- `block_index` is the block ordinal.
- `type` joins entity types with `|`.
- `parse_status` is `valid` or `invalid`, based on block parse error.

CSV cells containing commas, quotes, or line breaks are double-quoted; embedded
quotes are doubled. The file ends with a newline. A page with multiple entities
can legitimately produce multiple rows for one block. A no-entity raw-block row
is not automatically a duplicate.

CSV cannot preserve scan metadata, page status, HTTP metadata, block IDs,
entity IDs, parsed object shape, or distinction between an entity's serialized
JSON and a raw unparsed block. Do not claim those fields are missing export data
when auditing CSV alone.

## Markdown

Markdown starts with `# Sitemap Schema Scan`, target/status/page summary lines,
then one second-level heading containing each page URL. Each page includes page status, HTTP
status, JSON-LD block count, optional page error, and one `### JSON-LD block N`
section per block. Each block reports `Valid JSON-LD` or its parse error and
includes raw text inside a fenced `json` block.

Markdown is presentation-oriented. It does not preserve scan settings, IDs,
entities, parsed object structure, or all page metadata. A fence longer than
three backticks is used when raw text contains triple backticks.

## Cross-format checks

Only compare artifacts when they identify the same scan or have enough matching
evidence to establish that relationship. Valid comparisons include:

- target URL and scan status where represented;
- page URL set and page count;
- block count and ordinal set per page;
- valid/invalid parse status per block;
- entity/type presence where JSON, CSV, and source text expose comparable data.

Report representation loss as coverage, not as a defect. If URLs, counts, or
parse states disagree between otherwise matching exports, cite each artifact
and the exact values.
