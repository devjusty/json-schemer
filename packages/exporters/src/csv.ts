import type { PageDetail } from "@schemer/storage";
import type { ExportData } from "./types";
import { pagesOf } from "./types";

const HEADER = "page_url,block_index,context,type,parse_status,serialized_json";

function csvCell(value: string | null): string {
  const normalized = value ?? "";
  return /[",\n\r]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function rowsForPage(detail: PageDetail): string[] {
  const entitiesByBlock = new Map<string, typeof detail.entities>();
  for (const entity of detail.entities) {
    const entities = entitiesByBlock.get(entity.blockId) ?? [];
    entities.push(entity);
    entitiesByBlock.set(entity.blockId, entities);
  }

  const rows: string[] = [];
  for (const block of detail.blocks) {
    const entities = entitiesByBlock.get(block.id) ?? [];
    if (entities.length === 0) {
      rows.push(
        [detail.page.url, String(block.ordinal), "", "", block.parseError ? "invalid" : "valid", block.rawText]
          .map(csvCell)
          .join(","),
      );
      continue;
    }
    for (const entity of entities) {
      rows.push(
        [detail.page.url, String(block.ordinal), entity.context, entity.types.join("|"), block.parseError ? "invalid" : "valid", entity.serialized]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return rows;
}

export function serializeCsv(data: ExportData): string {
  return [HEADER, ...pagesOf(data).flatMap(rowsForPage), ""].join("\n");
}
