# Export Audit Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a project-specific agent skill that audits Jason Schemer JSON, CSV, and Markdown exports for data integrity and JSON-LD/schema quality.

**Architecture:** Keep the local skill instructions in `.agents/skills/json-schema-export-audit/SKILL.md` and publish the same collection under `skills/json-schema-export-audit/`. Place exact export shapes and invariants in `references/export-contract.md` for progressive disclosure. Add `evals/evals.json` with realistic prompts and expected outcomes, but defer model runs until the user confirms the test set.

**Tech Stack:** Markdown skill files, JSON eval manifest, existing TypeScript export contract in `packages/exporters` and `packages/storage`.

---

### Task 1: Create export contract reference

**Files:**
- Create: `.agents/skills/json-schema-export-audit/references/export-contract.md`

- [ ] **Step 1: Document JSON shape and invariants**

Include `formatVersion`, `scan`, `pages`, page/block/entity fields, ownership relationships, optional nullable fields, and count/ordinal rules grounded in `packages/storage/src/repositories.ts` and `packages/exporters/src/json.ts`.

- [ ] **Step 2: Document CSV and Markdown representations**

Record the exact CSV header, one-row-per-entity-or-raw-block behavior, quoting rules, and Markdown summary/page/block structure from `packages/exporters/src/csv.ts` and `packages/exporters/src/markdown.ts`.

- [ ] **Step 3: Define comparable cross-format checks**

List checks that are valid only when artifacts share a scan: target URL, page URLs/counts, block ordinals/counts, parse status, and entity/type presence. Explicitly identify fields that CSV/Markdown do not preserve.

### Task 2: Write audit skill instructions

**Files:**
- Create: `.agents/skills/json-schema-export-audit/SKILL.md`

- [ ] **Step 1: Add frontmatter and pushy trigger description**

Use skill name `json-schema-export-audit`. Trigger on requests to inspect, validate, QA, review, or audit Jason Schemer exports or scan artifacts, including JSON, CSV, Markdown, JSON-LD, sitemap, and schema-quality wording.

- [ ] **Step 2: Add evidence-first audit workflow**

Require inventory, safe parsing, structural checks, JSON-LD/schema checks, cross-format comparison, and explicit unavailable-check reporting. Tell agents to inspect the bundled reference before making project-specific claims.

- [ ] **Step 3: Add findings-first Markdown output contract**

Require severity-ranked findings with location, evidence, impact, recommendation, and coverage summary. Require distinction between export defects and source-site/schema observations; prohibit unsupported Google eligibility claims.

- [ ] **Step 4: Add boundaries and severity guidance**

Prevent mutation of supplied artifacts, avoid treating nullable optional fields as defects, and define `critical`, `high`, `medium`, `low`, and `info` consistently.

### Task 3: Create initial eval set

**Files:**
- Create: `.agents/skills/json-schema-export-audit/evals/evals.json`

- [ ] **Step 1: Add clean multi-format audit prompt**

Prompt should provide or reference matching JSON/CSV/Markdown artifacts and expect a concise no-defect report plus coverage limitations.

- [ ] **Step 2: Add corrupted/inconsistent export prompt**

Prompt should include malformed JSON or CSV quoting, an orphan/mismatched entity or count, and expect evidence-backed severity findings.

- [ ] **Step 3: Add schema-quality prompt**

Prompt should include valid JSON with weak or incomplete JSON-LD and expect syntax/data observations separated from SEO recommendations.

### Task 4: Validate skill package

**Files:**
- Verify: `.agents/skills/json-schema-export-audit/SKILL.md`
- Verify: `.agents/skills/json-schema-export-audit/references/export-contract.md`
- Verify: `.agents/skills/json-schema-export-audit/evals/evals.json`

- [ ] **Step 1: Check frontmatter and JSON syntax**

Run:

```bash
node -e 'const fs=require("node:fs"); const text=fs.readFileSync(".agents/skills/json-schema-export-audit/SKILL.md","utf8"); if (!text.startsWith("---\n") || !text.includes("name: json-schema-export-audit\n") || !text.includes("description:")) process.exit(1); JSON.parse(fs.readFileSync(".agents/skills/json-schema-export-audit/evals/evals.json","utf8"));'
```

Expected: command exits successfully.

- [ ] **Step 2: Scan for unresolved placeholders**

Run:

```bash
rg -n 'TBD|FIXME|<[^>]+>' .agents/skills/json-schema-export-audit
```

Expected: no matches.

- [ ] **Step 3: Review eval prompts for coverage**

Confirm evals cover clean input, corruption/inconsistency, schema quality, evidence citations, unavailable checks, and severity ordering before launching model runs.
