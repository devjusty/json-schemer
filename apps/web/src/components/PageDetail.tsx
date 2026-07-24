import type { PageDetail as PageDetailData } from "../api";

export function PageDetail({ detail, scanId }: { detail: PageDetailData; scanId: string }) {
  return (
    <aside className="detail-panel">
      <span className="eyebrow">Page detail</span>
      <h2>{detail.page.url}</h2>
      <p className="muted">{detail.page.status} · {detail.blocks.length} JSON-LD blocks</p>
      <div className="page-exports">
        {(["json", "markdown", "csv"] as const).map((format) => <a key={format} href={`/api/scans/${scanId}/pages/${detail.page.id}/export/${format}`}>Page {format.toUpperCase()}</a>)}
      </div>
      {detail.blocks.map((block) => (
        <details key={block.id} open>
          <summary>Block {block.ordinal} {block.parseError ? "· invalid" : "· valid"}</summary>
          {block.parseError && <p className="error-text">{block.parseError}</p>}
          <pre>{block.rawText}</pre>
          {block.parsed != null && <pre>{JSON.stringify(block.parsed, null, 2)}</pre>}
        </details>
      ))}
    </aside>
  );
}
