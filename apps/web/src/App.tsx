import { useEffect, useState } from "react";
import { cancelScan, createScan, getActiveScan, getPageDetail, listPages, subscribeToScan, type PageDetail as PageDetailData, type PageSummary, type Scan } from "./api";
import { PageDetail } from "./components/PageDetail";
import { PageTable } from "./components/PageTable";
import { ProgressPanel } from "./components/ProgressPanel";
import { ScanForm } from "./components/ScanForm";
import "./styles.css";

export function App() {
  const [targetUrl, setTargetUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [scan, setScan] = useState<Scan | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [detail, setDetail] = useState<PageDetailData | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getActiveScan().then((active) => { if (active) { setScan(active); void listPages(active.id).then(setPages); } }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!scan) return;
    return subscribeToScan(scan.id, (event) => {
      if (event.progress) setScan((current) => current ? { ...current, ...event.progress } : current);
      if (["page_completed", "scan_completed"].includes(event.type)) void listPages(scan.id).then(setPages);
    });
  }, [scan?.id]);

  async function startScan() {
    setBusy(true); setError(null); setDetail(null); setSelectedId(null);
    try {
      const created = await createScan({ targetUrl, sitemapUrl: sitemapUrl || null });
      setScan(created); setPages([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function selectPage(id: string) {
    if (!scan) return;
    setSelectedId(id);
    try { setDetail(await getPageDetail(scan.id, id)); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }

  return (
    <main className="shell">
      <header className="masthead"><div><span className="eyebrow">LOCAL CRAWLER / STRUCTURED DATA</span><h1>Jason Schemer</h1><p>Scan sitemap pages. See every JSON-LD block. Export clean evidence for review.</p></div><div className="mark">JS</div></header>
      <section className="setup-card"><ScanForm targetUrl={targetUrl} sitemapUrl={sitemapUrl} busy={busy} onTargetUrlChange={setTargetUrl} onSitemapUrlChange={setSitemapUrl} onSubmit={() => void startScan()} /><p className="hint">Balanced crawl · same-origin only · up to 500 URLs · no JavaScript execution</p></section>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!scan && <section className="empty-panel hero-empty"><span className="eyebrow">Ready when you are</span><h2>No scan loaded</h2><p>Enter website URL to begin. Results stay local on this machine.</p></section>}
      {scan && <><ProgressPanel scan={scan} /><nav className="export-bar" aria-label="Whole-site exports"><span>Export site</span>{(["json", "markdown", "csv"] as const).map((format) => <a key={format} href={`/api/scans/${scan.id}/export/${format}`} aria-label={`Whole-site ${format === "markdown" ? "Markdown" : format.toUpperCase()}`}>{format.toUpperCase()}</a>)}{!["completed", "failed", "canceled"].includes(scan.status) && <button type="button" onClick={() => void cancelScan(scan.id)}>Cancel</button>}</nav><section className="results-layout"><div><PageTable pages={pages} selectedId={selectedId} onSelect={(id) => void selectPage(id)} /></div>{detail ? <PageDetail detail={detail} scanId={scan.id} /> : <div className="empty-panel detail-empty">Select page to inspect raw blocks.</div>}</section></>}
    </main>
  );
}
