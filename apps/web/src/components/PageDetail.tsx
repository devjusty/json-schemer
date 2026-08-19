import { useEffect, useRef, useState } from "react";
import type { PageDetail as PageDetailData } from "../api";
import { pageStatusLabel } from "../pageStatusLabel";

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
  const [copyErrorBlockId, setCopyErrorBlockId] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportsReady = ["completed", "canceled", "failed"].includes(scanStatus);
  const partial = scanStatus !== "completed";
  const schemaTypes = Array.from(new Set(detail.entities.flatMap((entity) => entity.types)));

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);

  return (
    <aside className="detail-panel">
      <h2>
        {detail.page.url}
        <a
          href={detail.page.url}
          target="_blank"
          rel="noopener noreferrer"
          className="external-link"
          title="Open in new tab"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M9.5 1H12.5C12.7761 1 13 1.22386 13 1.5V4.5M13 4.5L9.5 0.999999L13 4.5ZM13 4.5V9.5C13 10.3284 12.3284 11 11.5 11H2.5C1.67157 11 1 10.3284 1 9.5V2.5C1 1.67157 1.67157 1 2.5 1H9.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">Open in new tab</span>
        </a>
      </h2>
      <p className="muted">
        {pageStatusLabel(detail.page.status)} · {detail.blocks.length} JSON-LD blocks
      </p>
      {schemaTypes.length > 0 && (
        <div className="schema-types">
          {schemaTypes.map((type) => (
            <span key={type} className="schema-type-pill">
              {type}
            </span>
          ))}
        </div>
      )}
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
                setCopyErrorBlockId(null);
                setCopiedBlockId(block.id);
                if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
                copiedTimer.current = setTimeout(() => {
                  setCopiedBlockId(null);
                  copiedTimer.current = null;
                }, 1500);
              } catch {
                setCopiedBlockId(null);
                setCopyErrorBlockId(block.id);
              }
            }}
          >
            {copiedBlockId === block.id
              ? `Copied JSON-LD block ${block.ordinal}`
              : `Copy JSON-LD block ${block.ordinal}`}
          </button>
          {block.parseError && <p className="error-text">{block.parseError}</p>}
          {copyErrorBlockId === block.id && (
            <p className="error-text" role="status">
              Unable to copy. Check clipboard permission and try again.
            </p>
          )}
          <p className="code-label">Raw</p>
          <pre>{block.rawText}</pre>
          {block.parsed != null && (
            <>
              <p className="code-label">Parsed</p>
              <pre>{JSON.stringify(block.parsed, null, 2)}</pre>
            </>
          )}
        </details>
      ))}
    </aside>
  );
}
