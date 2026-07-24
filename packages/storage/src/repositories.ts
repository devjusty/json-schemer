import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { PageStatus, ScanSettings, ScanStatus } from "@schemer/domain";

export interface ScanRecord {
  id: string;
  targetUrl: string;
  sitemapUrl: string | null;
  settings: ScanSettings;
  status: ScanStatus;
  createdAt: string;
  updatedAt: string;
  discovered: number;
  queued: number;
  completed: number;
  successful: number;
  failed: number;
  error: string | null;
}

export interface PageRecord {
  id: string;
  scanId: string;
  url: string;
  normalizedUrl: string;
  sitemapSource: string | null;
  status: PageStatus;
  httpStatus: number | null;
  contentType: string | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

export interface JsonLdBlockRecord {
  id: string;
  pageId: string;
  ordinal: number;
  rawText: string;
  parsed: unknown | null;
  parseError: string | null;
}

export interface SchemaEntityRecord {
  id: string;
  blockId: string;
  context: string | null;
  types: string[];
  serialized: string;
}

export interface PageDetail {
  page: PageRecord;
  blocks: JsonLdBlockRecord[];
  entities: SchemaEntityRecord[];
}

export interface SiteExportData {
  scan: ScanRecord;
  pages: PageDetail[];
}

export interface PageExportData {
  scan: ScanRecord;
  page: PageRecord;
  blocks: JsonLdBlockRecord[];
  entities: SchemaEntityRecord[];
}

interface ScanInput {
  id: string;
  targetUrl: string;
  sitemapUrl: string | null;
  settings: ScanSettings;
}

interface PageInput extends Omit<PageRecord, "createdAt"> {}

interface ProgressInput {
  status: ScanStatus;
  discovered: number;
  queued: number;
  completed: number;
  successful: number;
  failed: number;
  error?: string | null;
}

function now(): string {
  return new Date().toISOString();
}

function scanFromRow(row: Record<string, unknown>): ScanRecord {
  return {
    id: String(row.id),
    targetUrl: String(row.target_url),
    sitemapUrl: row.sitemap_url == null ? null : String(row.sitemap_url),
    settings: JSON.parse(String(row.settings_json)) as ScanSettings,
    status: String(row.status) as ScanStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    discovered: Number(row.discovered),
    queued: Number(row.queued),
    completed: Number(row.completed),
    successful: Number(row.successful),
    failed: Number(row.failed),
    error: row.error == null ? null : String(row.error),
  };
}

function pageFromRow(row: Record<string, unknown>): PageRecord {
  return {
    id: String(row.id),
    scanId: String(row.scan_id),
    url: String(row.url),
    normalizedUrl: String(row.normalized_url),
    sitemapSource: row.sitemap_source == null ? null : String(row.sitemap_source),
    status: String(row.status) as PageStatus,
    httpStatus: row.http_status == null ? null : Number(row.http_status),
    contentType: row.content_type == null ? null : String(row.content_type),
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    error: row.error == null ? null : String(row.error),
    createdAt: String(row.created_at),
  };
}

function blockFromRow(row: Record<string, unknown>): JsonLdBlockRecord {
  return {
    id: String(row.id),
    pageId: String(row.page_id),
    ordinal: Number(row.ordinal),
    rawText: String(row.raw_text),
    parsed: row.parsed_json == null ? null : JSON.parse(String(row.parsed_json)),
    parseError: row.parse_error == null ? null : String(row.parse_error),
  };
}

function entityFromRow(row: Record<string, unknown>): SchemaEntityRecord {
  return {
    id: String(row.id),
    blockId: String(row.block_id),
    context: row.context == null ? null : String(row.context),
    types: JSON.parse(String(row.types_json)) as string[],
    serialized: String(row.serialized),
  };
}

export function createRepositories(database: DatabaseSync) {
  const query = <T extends Record<string, unknown>>(sql: string, ...params: unknown[]): T[] =>
    database.prepare(sql).all(...(params as SQLInputValue[])) as unknown as T[];

  const getScan = (id: string): ScanRecord => {
    const row = database.prepare("SELECT * FROM scans WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error(`Scan not found: ${id}`);
    return scanFromRow(row);
  };

  const getPageDetail = (scanId: string, pageId: string): PageDetail => {
    const pageRow = database.prepare("SELECT * FROM pages WHERE id = ? AND scan_id = ?").get(pageId, scanId) as
      | Record<string, unknown>
      | undefined;
    if (!pageRow) throw new Error(`Page not found: ${pageId}`);
    const blocks = query<Record<string, unknown>>(
      "SELECT * FROM jsonld_blocks WHERE page_id = ? ORDER BY ordinal",
      pageId,
    ).map(blockFromRow);
    const entities = query<Record<string, unknown>>(
      "SELECT schema_entities.* FROM schema_entities JOIN jsonld_blocks ON jsonld_blocks.id = schema_entities.block_id WHERE jsonld_blocks.page_id = ? ORDER BY jsonld_blocks.ordinal, schema_entities.id",
      pageId,
    ).map(entityFromRow);
    return { page: pageFromRow(pageRow), blocks, entities };
  };

  return {
    replaceActiveScan(input: ScanInput): ScanRecord {
      const timestamp = now();
      database.exec("BEGIN");
      try {
        database.prepare("DELETE FROM scans").run();
        database
          .prepare(
            "INSERT INTO scans (id, target_url, sitemap_url, settings_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            input.id,
            input.targetUrl,
            input.sitemapUrl,
            JSON.stringify(input.settings),
            "queued",
            timestamp,
            timestamp,
          );
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
      return getScan(input.id);
    },

    getActiveScan(): ScanRecord | null {
      const row = database.prepare("SELECT * FROM scans ORDER BY created_at DESC LIMIT 1").get() as
        | Record<string, unknown>
        | undefined;
      return row ? scanFromRow(row) : null;
    },

    updateScanProgress(scanId: string, progress: ProgressInput): void {
      database
        .prepare(
          "UPDATE scans SET status = ?, updated_at = ?, discovered = ?, queued = ?, completed = ?, successful = ?, failed = ?, error = ? WHERE id = ?",
        )
        .run(
          progress.status,
          now(),
          progress.discovered,
          progress.queued,
          progress.completed,
          progress.successful,
          progress.failed,
          progress.error ?? null,
          scanId,
        );
    },

    upsertPage(input: PageInput): PageRecord {
      const createdAt = now();
      database
        .prepare(
          `INSERT INTO pages (id, scan_id, url, normalized_url, sitemap_source, status, http_status, content_type, duration_ms, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(scan_id, normalized_url) DO UPDATE SET url = excluded.url, sitemap_source = excluded.sitemap_source,
             status = excluded.status, http_status = excluded.http_status, content_type = excluded.content_type,
             duration_ms = excluded.duration_ms, error = excluded.error`,
        )
        .run(
          input.id,
          input.scanId,
          input.url,
          input.normalizedUrl,
          input.sitemapSource,
          input.status,
          input.httpStatus,
          input.contentType,
          input.durationMs,
          input.error,
          createdAt,
        );
      const row = database
        .prepare("SELECT * FROM pages WHERE scan_id = ? AND normalized_url = ?")
        .get(input.scanId, input.normalizedUrl) as Record<string, unknown>;
      return pageFromRow(row);
    },

    insertJsonLdBlock(input: Omit<JsonLdBlockRecord, "parsed"> & { parsed: unknown | null }): void {
      database
        .prepare(
          "INSERT INTO jsonld_blocks (id, page_id, ordinal, raw_text, parsed_json, parse_error) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          input.id,
          input.pageId,
          input.ordinal,
          input.rawText,
          input.parsed == null ? null : JSON.stringify(input.parsed),
          input.parseError,
        );
    },

    insertSchemaEntity(input: SchemaEntityRecord): void {
      database
        .prepare("INSERT INTO schema_entities (id, block_id, context, types_json, serialized) VALUES (?, ?, ?, ?, ?)")
        .run(input.id, input.blockId, input.context, JSON.stringify(input.types), input.serialized);
    },

    listPages(scanId: string, filters: { status?: PageStatus } = {}): PageRecord[] {
      const rows = filters.status
        ? query<Record<string, unknown>>(
            "SELECT * FROM pages WHERE scan_id = ? AND status = ? ORDER BY url",
            scanId,
            filters.status,
          )
        : query<Record<string, unknown>>("SELECT * FROM pages WHERE scan_id = ? ORDER BY url", scanId);
      return rows.map(pageFromRow);
    },

    getPageDetail,

    getSiteExportData(scanId: string): SiteExportData {
      return { scan: getScan(scanId), pages: this.listPages(scanId).map((page) => getPageDetail(scanId, page.id)) };
    },

    getPageExportData(scanId: string, pageId: string): PageExportData {
      return { scan: getScan(scanId), ...getPageDetail(scanId, pageId) };
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
