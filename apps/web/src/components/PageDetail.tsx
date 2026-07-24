import { useEffect, useRef, useState } from "react";
import type { PageDetail as PageDetailData } from "../api";

export function PageDetail({
  detail,
  scanId,
  scanStatus,
}: {
  detail: PageDetailData;
  scanId: string;
  scanStatus: string;
}) {
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportsReady = ["completed", "canceled", "failed"].includes(scanStatus);
  const partial = scanStatus !== "completed";

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);

  return (
    <aside className="detail-panel">
      <span className="eyebrow">Page detail</span>
      <h2>{detail.page.url}</h2>
      <p className="muted">
        {detail.page.status} · {detail.blocks.length} JSON-LD blocks
      </p>
      <div className="page-exports">
        {partial && <span className="partial-label">Partial results</span>}
        {(["json", "markdown", "csv"] as const).map((format) =>
          exportsReady ? (
            <a key={format} href={`/api/scans/${scanId}/pages/${detail.page.id}/export/${format}`}>
              Page {format.toUpperCase()}
            </a>
          ) : (
            <span key={format} className="export-disabled" aria-disabled="true" title="Available when scan stops">
              Page {format.toUpperCase()}
            </span>
          ),
        )}
      </div>
      {detail.blocks.map((block) => (
        <details key={block.id} open>
          <summary>
            Block {block.ordinal} {block.parseError ? "· invalid" : "· valid"}
          </summary>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(block.rawText);
                setCopiedBlockId(block.id);
                if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
                copiedTimer.current = setTimeout(() => {
                  setCopiedBlockId(null);
                  copiedTimer.current = null;
                }, 1500);
              } catch {
                // Clipboard access can be unavailable or rejected by the browser.
              }
            }}
          >
            {copiedBlockId === block.id ? `Copied JSON-LD block ${block.ordinal}` : `Copy JSON-LD block ${block.ordinal}`}
          </button>
          {block.parseError && <p className="error-text">{block.parseError}</p>}
          <pre>{block.rawText}</pre>
          {block.parsed != null && <pre>{JSON.stringify(block.parsed, null, 2)}</pre>}
        </details>
      ))}
    </aside>
  );
}
