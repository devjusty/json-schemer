import type { PageDetail, PageExportData, SiteExportData } from "@schemer/storage";

export type ExportData = SiteExportData | PageExportData;

export function pagesOf(data: ExportData): PageDetail[] {
  return "pages" in data ? data.pages : [{ page: data.page, blocks: data.blocks, entities: data.entities }];
}
