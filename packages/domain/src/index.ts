export const PAGE_STATUSES = [
  "success",
  "no_jsonld",
  "invalid_jsonld",
  "http_error",
  "parse_error",
  "blocked",
  "fetch_error",
] as const;

export type PageStatus = (typeof PAGE_STATUSES)[number];

export const DEFAULT_SCAN_SETTINGS = {
  maxUrls: 500,
  concurrency: 4,
  delayMs: 250,
  timeoutMs: 15_000,
  maxResponseBytes: 5_000_000,
  maxRedirects: 5,
  respectRobots: true,
  sameOriginOnly: true,
} as const;

export type ScanSettings = typeof DEFAULT_SCAN_SETTINGS;
export type ScanStatus =
  | "queued"
  | "discovering"
  | "crawling"
  | "completed"
  | "failed"
  | "canceled";
export type ExportFormat = "json" | "markdown" | "csv";
export type ExportScope = "site" | "page";

export interface ScanProgress {
  scanId: string;
  discovered: number;
  queued: number;
  completed: number;
  successful: number;
  failed: number;
}
