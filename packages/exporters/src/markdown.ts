import type { PageDetail } from "@schemer/storage";
import type { ExportData } from "./types";
import { pagesOf } from "./types";

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function rawFence(rawText: string): string {
  const fence = rawText.includes("```") ? "````" : "```";
  return `${fence}json\n${rawText}\n${fence}`;
}

function renderPage(detail: PageDetail): string {
  const lines = [
    `## ${escapeCell(detail.page.url)}`,
    "",
    `- Status: ${detail.page.status}`,
    `- HTTP status: ${detail.page.httpStatus ?? "n/a"}`,
    `- JSON-LD blocks: ${detail.blocks.length}`,
  ];
  if (detail.page.error) lines.push(`- Error: ${escapeCell(detail.page.error)}`);
  for (const block of detail.blocks) {
    lines.push("", `### JSON-LD block ${block.ordinal}`, "", block.parseError ? `Parse error: ${escapeCell(block.parseError)}` : "Valid JSON-LD", "", rawFence(block.rawText));
  }
  return lines.join("\n");
}

export function serializeMarkdown(data: ExportData): string {
  return [
    "# Sitemap Schema Scan",
    "",
    `Target: ${escapeCell(data.scan.targetUrl)}`,
    `Status: ${data.scan.status}`,
    `Pages: ${pagesOf(data).length}`,
    "",
    ...pagesOf(data).map(renderPage),
    "",
  ].join("\n");
}
