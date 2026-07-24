import type { ExportData } from "./types";
import { pagesOf } from "./types";

export function serializeJson(data: ExportData): string {
  return JSON.stringify(
    {
      formatVersion: 1,
      scan: data.scan,
      pages: pagesOf(data),
    },
    null,
    2,
  );
}
