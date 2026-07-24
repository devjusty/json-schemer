export interface Scan {
  id: string;
  targetUrl: string;
  sitemapUrl?: string | null;
  status: string;
  discovered?: number;
  queued?: number;
  completed?: number;
  successful?: number;
  failed?: number;
}

export interface PageSummary {
  id: string;
  url: string;
  status: string;
  httpStatus: number | null;
  error: string | null;
}

export interface PageDetail {
  page: PageSummary & { normalizedUrl: string; contentType: string | null; durationMs: number | null };
  blocks: Array<{ id: string; ordinal: number; rawText: string; parsed: unknown; parseError: string | null }>;
  entities: Array<{ id: string; blockId: string; context: string | null; types: string[]; serialized: string }>;
}

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body — fall back to status code */
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function createScan(input: { targetUrl: string; sitemapUrl: string | null }): Promise<Scan> {
  return request<Scan>("/api/scans", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function getActiveScan(): Promise<Scan | null> {
  return request<Scan | null>("/api/scans/active");
}

export function listPages(scanId: string): Promise<PageSummary[]> {
  return request<PageSummary[]>(`/api/scans/${encodeURIComponent(scanId)}/pages`);
}

export function getPageDetail(scanId: string, pageId: string): Promise<PageDetail> {
  return request<PageDetail>(`/api/scans/${encodeURIComponent(scanId)}/pages/${encodeURIComponent(pageId)}`);
}

export function cancelScan(scanId: string): Promise<Scan> {
  return request<Scan>(`/api/scans/${encodeURIComponent(scanId)}/cancel`, { method: "POST" });
}

export function subscribeToScan(
  scanId: string,
  onEvent: (event: { type: string; progress?: Partial<Scan> }) => void,
): () => void {
  const source = new EventSource(`/api/scans/${encodeURIComponent(scanId)}/events`);
  source.onmessage = (message) => onEvent(JSON.parse(message.data) as { type: string; progress?: Partial<Scan> });
  return () => source.close();
}
