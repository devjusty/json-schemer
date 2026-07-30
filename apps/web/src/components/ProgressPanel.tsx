import type { Scan } from "../api";

const TERMINAL = new Set(["completed", "canceled", "failed"]);

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}

function sitemapPathLabel(sitemapUrl: string): string {
  try {
    const path = new URL(sitemapUrl).pathname;
    return path || sitemapUrl;
  } catch {
    return sitemapUrl;
  }
}

function formatFinishedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ProgressPanel({ scan }: { scan: Scan }) {
  const terminal = TERMINAL.has(scan.status);
  const title = scan.status === "queued" ? "Scan queued" : scan.status;
  const domain = hostnameOf(scan.targetUrl);
  const sitemapUrl = scan.sitemapUrl?.trim() || null;
  const finishedAt = terminal && scan.updatedAt ? formatFinishedAt(scan.updatedAt) : null;

  return (
    <section className="progress-panel" aria-label="Scan progress">
      <div className="progress-summary">
        <strong>{title}</strong>
        <p className="progress-meta">
          <span>{domain}</span>
          <span aria-hidden="true">·</span>
          {sitemapUrl ? (
            <span>
              Sitemap{" "}
              <a href={sitemapUrl} target="_blank" rel="noopener noreferrer">
                {sitemapPathLabel(sitemapUrl)}
              </a>
            </span>
          ) : (
            <span>{scan.status === "discovering" || scan.status === "queued" ? "Sitemap discovering…" : "No sitemap"}</span>
          )}
          {finishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Finished {finishedAt}</span>
            </>
          ) : null}
        </p>
      </div>
      <div className="progress-grid">
        <span>
          <b>{scan.discovered ?? 0}</b> discovered
        </span>
        <span>
          <b>{scan.completed ?? 0}</b> completed
        </span>
        <span>
          <b>{scan.successful ?? 0}</b> with JSON-LD
        </span>
        <span>
          <b>{scan.failed ?? 0}</b> failed
        </span>
      </div>
    </section>
  );
}
