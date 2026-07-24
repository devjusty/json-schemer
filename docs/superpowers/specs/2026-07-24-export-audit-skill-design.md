# Export Audit Skill Design

## Goal

Create an agent skill that audits JSON, CSV, and Markdown exports produced by
JSON Schemer. It must assess both export/data integrity and JSON-LD/schema
quality, without modifying source data or silently treating missing evidence as
failure.

## Trigger

Trigger when a user asks an agent to review, validate, inspect, QA, or audit a
JSON Schemer export or exported scan artifact. Trigger for JSON, CSV, or
Markdown files, including requests that do not explicitly say “export” when
the artifact clearly contains scan/page/JSON-LD data.

## Inputs and contract

The skill accepts one artifact or a set of artifacts from the same scan. It
must identify format, scope, and available evidence before auditing. The
project export contract is documented in a bundled reference:

- JSON: `formatVersion`, `scan`, and `pages`; each page contains `page`,
  `blocks`, and `entities`.
- CSV: header `page_url,block_index,context,type,parse_status,serialized_json`,
  with one row per entity or raw block.
- Markdown: scan summary followed by page sections and JSON-LD block sections.

Cross-format checks apply only when comparable artifacts are provided. The
skill should compare page counts, URLs, block ordinals, parse statuses, and
entity/type data where representations allow it.

## Audit workflow

1. Inventory files, format, scan scope, and whether artifacts appear complete.
2. Parse each artifact safely; report malformed or truncated content as a
   finding rather than inventing conclusions.
3. Check structural integrity: required fields, relationships, duplicate or
   orphan records, count consistency, URL identity, block ordering, parse
   status, and CSV quoting/row shape.
4. Check JSON-LD quality: valid JSON, `@context`, `@type`, schema entity
   usefulness, missing/empty values, suspicious type/context values, and
   scan/page failures. Do not claim Google eligibility from exports alone;
   distinguish syntax/data observations from SEO recommendations.
5. Cross-check formats when possible and identify information lost by a
   flattened or human-readable representation.
6. Produce findings-first Markdown.

## Report format

```markdown
# Export Audit

## Findings

### [SEVERITY] Short finding
- Location: artifact and page/row/block reference
- Evidence: exact observed value or concise excerpt
- Impact: why it matters
- Recommendation: concrete next action

## Coverage
- Artifacts checked:
- Checks unavailable:
- Summary: counts by severity
```

Use `critical`, `high`, `medium`, `low`, and `info`. Findings must be ordered
by severity, then impact. Empty findings must be stated explicitly. Separate
export defects from source-site/schema quality observations.

## Boundaries

- Never edit or rewrite supplied exports unless explicitly requested.
- Never infer absent pages, entities, or SEO validity from a single format.
- Do not treat optional `null` fields as defects without contextual evidence.
- Do not duplicate the existing schema implementation skill; this skill audits
  exported evidence and recommends fixes.

## Verification

The skill will include 2–3 realistic eval prompts covering a clean multi-format
export, a corrupted/inconsistent export, and schema-quality findings. Evals
will test whether reports cite evidence, distinguish unavailable checks, and
prioritize findings correctly.
