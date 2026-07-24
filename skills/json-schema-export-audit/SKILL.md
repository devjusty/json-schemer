---
name: json-schema-export-audit
description: Audit JSON Schemer exports and scan artifacts for data integrity and JSON-LD/Schema.org quality. Use whenever a user asks to review, validate, inspect, QA, compare, or audit exported JSON, CSV, Markdown, JSON-LD, sitemap-scan, or schema results from this project, even if they do not use the word export.
---

# Export Audit

Audit supplied JSON Schemer artifacts. Focus on evidence, not assumptions:
determine what each artifact contains, validate what can be validated, and mark
unavailable checks explicitly.

## Before auditing

1. Inventory every supplied file and identify its format, scan scope, and
   apparent completeness.
2. Read `references/export-contract.md` before making claims about fields,
   relationships, row semantics, or representation loss.
3. Never modify, normalize, or rewrite supplied artifacts unless the user
   explicitly requests a transformed copy.

## Audit workflow

### 1. Parse safely

Parse JSON and embedded JSON-LD independently. Parse CSV with a real CSV parser
or carefully account for quoted commas, doubled quotes, and newlines. Treat
malformed or truncated content as a finding with exact evidence. If parsing
fails, do not continue as though omitted records were absent.

### 2. Check export integrity

Check, when represented:

- required top-level fields and `formatVersion`;
- page URL identity, duplicate pages, and page counts;
- scan/page/block/entity ownership relationships;
- block ordinal uniqueness and gaps;
- parse status versus `parseError`/parsed content;
- entity references, serialized JSON, types, and contexts;
- scan progress count consistency;
- CSV header, row widths, quoting, newline handling, and valid/invalid status;
- Markdown page/block section counts and raw JSON-LD fence integrity.

Do not call nullable optional fields defects without contextual evidence. Do not
call a legitimate multi-entity CSV expansion duplicate data. Distinguish a
source scan failure from an exporter defect.

### 3. Check JSON-LD and schema quality

For each available JSON-LD block or entity:

- validate JSON syntax;
- check presence and plausibility of `@context` and `@type`;
- identify empty, contradictory, suspicious, or obviously incomplete values;
- note parse errors, failed pages, non-HTML responses, and missing entities;
- assess whether extracted types and properties appear useful for the page.

Separate observations into:

- **Export/data defect**: artifact cannot faithfully represent scan data or has
  an internal inconsistency.
- **Schema/site observation**: exported JSON-LD is syntactically valid or
  invalid, incomplete, weak, or potentially mismatched with page evidence.

Do not claim Google rich-result eligibility, ranking impact, or page-content
match from exports alone. State what evidence is missing and recommend a
validator or source-page review when needed.

### 4. Compare formats

When artifacts appear to come from the same scan, compare only fields with
comparable representations: target URL, page URLs/counts, block ordinals/counts,
parse status, and entity/type presence. Cite both artifacts for disagreements.
Treat fields absent from CSV or Markdown as representation limits, not defects.

## Severity

Use these levels, ordered highest first:

- `critical`: artifact is unusable or widespread corruption prevents reliable
  conclusions.
- `high`: significant records or relationships are wrong, missing, or
  contradictory; audit conclusions are materially unreliable.
- `medium`: localized integrity issue or schema problem likely to affect
  interpretation or structured-data usefulness.
- `low`: minor inconsistency, weak metadata, or limited presentation issue.
- `info`: useful observation, coverage limitation, or recommendation without a
  demonstrated defect.

Do not inflate severity for normal nullable fields, intentional format
flattening, or a single weak optional schema property.

## Output

Return findings first, ordered by severity and then impact:

```markdown
# Export Audit

## Findings

### [high] Short finding
- Category: export/data defect or schema/site observation
- Location: artifact and page/row/block reference
- Evidence: exact value or concise excerpt
- Impact: why it matters
- Recommendation: concrete next action

## Coverage
- Artifacts checked: ...
- Checks unavailable: ...
- Summary: critical 0, high 0, medium 0, low 0, info 0
```

If no defects are found, say so explicitly and still report coverage limits.
Keep evidence concise and quote exact URLs, ordinals, statuses, counts, or
parse errors. Never bury a high-severity finding in a general summary.
