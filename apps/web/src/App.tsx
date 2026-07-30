import { useState } from "react";
import { ScanForm } from "./components/ScanForm";
import { ScanWorkspace } from "./components/ScanWorkspace";
import { useScanSession } from "./hooks/useScanSession";
import "./styles.css";

export function App() {
  const [targetUrl, setTargetUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const session = useScanSession();

  return (
    <main className="shell">
      <header className="masthead">
        <div>
          <h1>JSON Schemer</h1>
          <p>Scan sitemap pages. See every JSON-LD block. Export clean evidence for review.</p>
        </div>
        <div className="mark" aria-hidden="true">
          JS
        </div>
      </header>
      <section className="setup-card">
        <ScanForm
          targetUrl={targetUrl}
          sitemapUrl={sitemapUrl}
          busy={session.busy}
          onTargetUrlChange={setTargetUrl}
          onSitemapUrlChange={setSitemapUrl}
          onSubmit={() => void session.startScan(targetUrl, sitemapUrl)}
        />
        <p className="hint">Balanced crawl · same-origin only · up to 500 URLs · no JavaScript execution</p>
      </section>
      {session.error && (
        <div className="error-banner" role="alert">
          {session.error}
        </div>
      )}
      {!session.scan && (
        <p className="idle-status" role="status">
          No scan loaded — enter a website URL above. Results stay on this machine.
        </p>
      )}
      {session.scan && (
        <ScanWorkspace
          scan={session.scan}
          pages={session.pages}
          detail={session.detail}
          selectedId={session.selectedId}
          onCancel={session.cancelScan}
          cancelBusy={session.cancelBusy}
          busy={session.busy}
          onSelectPage={(id) => void session.selectPage(id)}
        />
      )}
    </main>
  );
}
