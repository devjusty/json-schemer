import type { Scan } from "../api";
import { NumberTicker } from "./NumberTicker";

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
  const discovered = scan.discovered ?? 0;
  const completed = scan.completed ?? 0;
  const successful = scan.successful ?? 0;
  const failed = scan.failed ?? 0;

  return (
    <section className="progress-panel" aria-label="Scan progress">
      <p className="sr-only" role="status">
        {title}: {discovered} discovered, {completed} completed, {successful} with JSON-LD, {failed} failed
      </p>
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
            <span>
              {scan.status === "discovering" || scan.status === "queued" ? "Sitemap discovering…" : "No sitemap"}
            </span>
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
          <b>
            <NumberTicker value={discovered} />
          </b>{" "}
          discovered
        </span>
        <span>
          <b>
            <NumberTicker value={completed} />
          </b>{" "}
          completed
        </span>
        <span>
          <b>
            <NumberTicker value={successful} />
          </b>{" "}
          with JSON-LD
        </span>
        <span>
          <b>
            <NumberTicker value={failed} />
          </b>{" "}
          failed
        </span>
      </div>
    </section>
  );
}
