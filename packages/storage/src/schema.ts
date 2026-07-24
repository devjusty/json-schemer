export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  target_url TEXT NOT NULL,
  sitemap_url TEXT,
  settings_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  discovered INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  successful INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  sitemap_source TEXT,
  status TEXT NOT NULL,
  http_status INTEGER,
  content_type TEXT,
  duration_ms INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(scan_id, normalized_url)
);

CREATE TABLE IF NOT EXISTS jsonld_blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_json TEXT,
  parse_error TEXT,
  UNIQUE(page_id, ordinal)
);

CREATE TABLE IF NOT EXISTS schema_entities (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL REFERENCES jsonld_blocks(id) ON DELETE CASCADE,
  context TEXT,
  types_json TEXT NOT NULL,
  serialized TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS pages_scan_status_idx ON pages(scan_id, status);
CREATE INDEX IF NOT EXISTS blocks_page_idx ON jsonld_blocks(page_id, ordinal);
CREATE INDEX IF NOT EXISTS entities_block_idx ON schema_entities(block_id);
`;
