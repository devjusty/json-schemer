---
name: JSON Schemer
description: Local moss-terminal UI for sitemap JSON-LD evidence
colors:
  chartreuse-signal: "#b7db7a"
  chartreuse-soft: "#d7ef9e"
  moss-label: "#9ec463"
  moss-border: "#718c58"
  night-soil: "#101211"
  moss-canopy: "#27372d"
  panel-surface: "#191f1a"
  panel-border: "#354139"
  field-bg: "#111611"
  field-border: "#4a5b4a"
  soft-parchment: "#f4f0e5"
  body-ink: "#e9e6dc"
  muted-sage: "#a6afa3"
  label-sage: "#bdc6b9"
  quiet-sage: "#7e8b7d"
  grid-sage: "#8c9a8a"
  row-selected: "#28382c"
  row-rule: "#29342c"
  code-bg: "#101611"
  code-ink: "#c6d6bb"
  coral-fault: "#ef9277"
  coral-ink: "#ffc0a8"
  fault-surface: "#351f1d"
  amber-partial: "#e0bd76"
  cancel-border: "#81564e"
  disabled-ink: "#667366"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(3rem, 8vw, 7rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.07em"
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  title:
    fontFamily: "Georgia, serif"
    fontSize: "1.4rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  metric:
    fontFamily: "Georgia, serif"
    fontSize: "1.6rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.7rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.16em"
  code:
    fontFamily: "ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  none: "0px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  "2xl": "28px"
  "3xl": "42px"
  shell-gutter: "48px"
  shell-gutter-mobile: "28px"
components:
  button-primary:
    backgroundColor: "{colors.chartreuse-signal}"
    textColor: "{colors.night-soil}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
  button-primary-disabled:
    backgroundColor: "{colors.chartreuse-signal}"
    textColor: "{colors.night-soil}"
    rounded: "{rounded.none}"
    padding: "13px 18px"
  button-cancel:
    backgroundColor: "transparent"
    textColor: "{colors.coral-fault}"
    rounded: "{rounded.none}"
    padding: "8px 11px"
  button-export:
    backgroundColor: "{colors.chartreuse-signal}"
    textColor: "{colors.night-soil}"
    rounded: "{rounded.none}"
    padding: "8px 11px"
  input-field:
    backgroundColor: "{colors.field-bg}"
    textColor: "{colors.soft-parchment}"
    rounded: "{rounded.none}"
    padding: "13px 14px"
  panel-surface:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.body-ink}"
    rounded: "{rounded.none}"
    padding: "22px"
  mark-badge:
    backgroundColor: "transparent"
    textColor: "{colors.chartreuse-soft}"
    rounded: "{rounded.none}"
    size: "64px"
---

# Design System: JSON Schemer

## Overview

**Creative North Star: "The Moss Terminal"**

JSON Schemer’s UI is a dense, operational, slightly editorial workspace for local structured-data evidence. It reads like a field terminal grown into moss and parchment: near-black ground, olive panel surfaces, chartreuse as scarce signal, and a Georgia display mark that keeps the brand from feeling like generic SaaS chrome.

Surfaces stay sharp and instrumental. Borders and tonal layering do the work of depth. Corners stay square. Typography splits labor cleanly: serif for brand and metrics, Inter for reading and controls, monospace for labels, status, and JSON. The system rejects SaaS purple, glassmorphism, and rounded marketing cards.

**Key Characteristics:**
- Dark olive terminal atmosphere with parchment text
- Square geometry and 1px hairline borders
- Chartreuse as scarce action/status signal
- Tripartite type: Georgia / Inter / mono
- Flat tonal panels; lift reserved for focus and future overlays

## Colors

A forest-night palette: deep soil backgrounds, moss panels, parchment ink, and a single acidic signal green with coral/amber exception colors.

### Primary
- **Chartreuse Signal** (`#b7db7a`): Primary actions, export chips, focus border. The rare bright instrument color.
- **Chartreuse Soft** (`#d7ef9e`): Links, selected accents, mark glyph, success-adjacent status text.
- **Moss Label** (`#9ec463`): Eyebrow labels and quiet accent type.

### Secondary
- **Moss Border** (`#718c58`): Mark badge stroke; secondary green border accent.

### Neutral
- **Night Soil** (`#101211`): Page ground and primary button text on chartreuse.
- **Moss Canopy** (`#27372d`): Radial wash at the top of the viewport.
- **Panel Surface** (`rgba(25, 31, 26, 0.82)` / solid `#191f1a`): Setup, progress, empty, and detail panels.
- **Panel Border** (`#354139`): Default panel and table outer stroke.
- **Field Background** (`#111611`): Input wells.
- **Field Border** (`#4a5b4a`): Resting input stroke; disabled export chip stroke.
- **Soft Parchment** (`#f4f0e5`): Display headlines and strong metric text.
- **Body Ink** (`#e9e6dc`): Default foreground.
- **Muted Sage** (`#a6afa3`): Masthead supporting copy.
- **Label Sage** (`#bdc6b9`): Form labels.
- **Quiet Sage** (`#7e8b7d`): Hints, muted copy, table headers.
- **Grid Sage** (`#8c9a8a`): Progress captions and empty-state body.
- **Row Selected** (`#28382c`): Selected table row wash.
- **Row Rule** (`#29342c`): Table row dividers.
- **Code Background** (`#101611`) / **Code Ink** (`#c6d6bb`): JSON-LD `<pre>` blocks.

### Exception / Status
- **Coral Fault** (`#ef9277`): Errors, cancel action text, fault status.
- **Coral Ink** (`#ffc0a8`): Error banner text.
- **Fault Surface** (`#351f1d`): Error banner background.
- **Amber Partial** (`#e0bd76`): Partial-results label and `no_jsonld` status.
- **Cancel Border** (`#81564e`): Cancel button stroke.
- **Disabled Ink** (`#667366`): Disabled export chip text.

### Named Rules
**The Signal Budget Rule.** Chartreuse is for actions, links, and status success only; don’t flood panels with it.

## Typography

**Display Font:** Georgia (serif fallback)
**Body Font:** Inter (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** `ui-monospace, monospace`

**Character:** Editorial serif for identity and numbers; utilitarian sans for controls; mono for machine evidence. Dense and slightly literary without becoming a brochure.

### Hierarchy
- **Display** (700, `clamp(3rem, 8vw, 7rem)`, 0.9, tracking `-0.07em`): Product name in the masthead only.
- **Headline** (700, `2rem`, Georgia): Empty-state hero titles.
- **Title** (700, `1.4rem`, Georgia): Page detail URL heading.
- **Metric** (700, `1.6–1.7rem`, Georgia): Progress status and count figures.
- **Body** (400, `1.05rem`, Inter): Masthead supporting sentence; max width ~500px.
- **UI** (400, `0.78–0.8rem`, Inter): Labels, table cells, summaries, hints.
- **Label** (700, `0.68–0.7rem`, mono, uppercase, tracking `0.1–0.16em`): Eyebrows, table headers, status chips, partial label, page export meta.
- **Code** (400, `0.72rem` / 1.5, mono): Raw and parsed JSON-LD blocks.

### Named Rules
**The Evidence Type Rule.** Georgia for brand/metrics display; Inter for UI body; mono for labels, status, JSON.

## Layout

Centered shell: `min(1400px, calc(100% - 48px))`, vertical padding `42px / 72px`. Masthead is a two-column flex with brand block and rotated mark. Setup form is a three-column grid (`1.3fr 1fr auto`) collapsing to one column below `850px`. After a scan starts, progress sits full-width; results use a two-column grid (`1.4fr / 0.8fr`, detail min `320px`) stacking on small screens. Progress metrics use a four-up auto grid, two-up on mobile. Spacing rhythm clusters around 8 / 10 / 14 / 18 / 22 / 28 / 42px. Density is high: operational information first, little decorative air.

## Elevation & Depth

Flat by default. Depth comes from tonal panel fills (`rgba(25, 31, 26, 0.82)`), 1px borders, the moss radial wash on the page ground, and selected-row washes. The only intentional “lift” today is the chartreuse focus ring (`0 0 0 2px #b7db7a33`). Soft ambient shadows are allowed later for overlays/modals if needed — not for resting panels.

### Shadow Vocabulary
- **Focus ring** (`box-shadow: 0 0 0 2px #b7db7a33`): Input focus only.
- **Ambient overlay** (future): Soft ambient shadow for overlays only; never as default panel chrome.

### Named Rules
**The Flat-By-Default Rule.** Resting surfaces are flat tonal panels. Shadows appear only for focus rings or future overlay elevation.

## Shapes

Square everywhere. Borders are 1px solid strokes in panel/field greens. The signature silhouette is the 64×64 rotated (`8deg`) mark badge with a moss border. Error banners use a 3px left accent bar instead of rounded callouts. Tables are hairline-ruled, not card stacks.

### Named Rules
**The Zero-Radius Rule.** Corners stay square (`0`); no pill buttons or marketing card radii.

## Components

Sharp and instrumental: square hits of chartreuse for commit actions, quiet panels for reading, mono labels for machine state.

### Buttons
- **Shape:** Square (`0` radius), 1px border matching fill or stroke role.
- **Primary:** Chartreuse Signal fill, Night Soil text, padding `13px 18px`, weight 700.
- **Export chip:** Same fill language, tighter padding `8px 11px`, `0.7rem` type.
- **Cancel:** Transparent fill, Coral Fault text, Cancel Border stroke, trailing in the export bar.
- **Link button:** No chrome; Chartreuse Soft text for table URLs.
- **Disabled:** Opacity `0.55`, `cursor: wait` while scanning.

### Cards / Containers
- **Corner Style:** Square.
- **Background:** Panel Surface (~82% opaque olive).
- **Shadow Strategy:** None at rest (see Elevation).
- **Border:** Panel Border 1px.
- **Internal Padding:** Setup `22px`; progress `20px 22px`; empty/detail `20–26px`.

### Inputs / Fields
- **Style:** Field Background, Field Border, Soft Parchment text, square, padding `13px 14px`.
- **Focus:** Border Chartreuse Signal + focus ring.
- **Label:** Label Sage, `0.78rem`, 8px gap above field.

### Navigation
- No global app nav. Local export bar acts as a utility strip: muted “Export site” label, optional Amber Partial badge, chartreuse format links or disabled chips, cancel trailing right.

### Signature: Mark Badge
- 64×64 grid, 1px Moss Border, Chartreuse Soft “JS”, mono 700, rotated 8°. Brand punctuation, not a functional control.

### Signature: Progress Panel
- Eyebrow + Georgia status title left; four Georgia metric figures right with Quiet/Grid Sage captions.

### Signature: Results Table + Detail
- Hairline table with mono uppercase headers; selected row wash; status color by outcome. Detail panel stacks eyebrow, Georgia URL title, page export row, and open `<details>` JSON blocks on Code Background.

### Status & Alerts
- Success/neutral status: Chartreuse Soft mono.
- HTTP/fetch/invalid JSON-LD: Coral Fault.
- No JSON-LD: Amber Partial.
- Error banner: Fault Surface, Coral Ink, 3px Coral Fault left bar.

## Do's and Don'ts

### Do:
- **Do** keep corners at `0` and borders at 1px tonal strokes.
- **Do** spend Chartreuse Signal on primary actions, exports, links, and focus only.
- **Do** use Georgia for the product name and metric figures; Inter for body/controls; mono for labels, status, and JSON.
- **Do** prefer dense operational layout (shell → setup → progress → table/detail) over dashboard card grids.
- **Do** keep error and partial states in Coral Fault / Amber Partial — never invent a third accent family.

### Don't:
- **Don't** introduce SaaS purple, indigo glows, or gradient text.
- **Don't** use glassmorphism, heavy multi-layer shadows, or rounded marketing cards.
- **Don't** round buttons into pills or soft-UI radii.
- **Don't** flood panel backgrounds with chartreuse fills.
- **Don't** mix display/body/mono roles (e.g. Georgia for table cells, Inter for the product name).
