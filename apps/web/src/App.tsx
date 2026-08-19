import { useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { ScanForm } from "./components/ScanForm";
import { ScanWorkspace } from "./components/ScanWorkspace";
import { useScanSession } from "./hooks/useScanSession";
import "./styles.css";

export function App() {
  const [targetUrl, setTargetUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const hydratedScanId = useRef<string | null>(null);
  const session = useScanSession();

  useEffect(() => {
    const active = session.scan;
    if (!active || hydratedScanId.current === active.id) return;
    setTargetUrl(active.targetUrl);
    setSitemapUrl(active.sitemapUrl ?? "");
    hydratedScanId.current = active.id;
  }, [session.scan]);

  return (
    <>
      <Toaster />
      <main className="shell">
        <header className="masthead">
          <div>
            <h1>JSON Schemer</h1>
            <p>Scan sitemap pages, inspect JSON-LD blocks, and export what the crawl found.</p>
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
          <p className="hint">
            Leave sitemap blank to read it from robots.txt. Same-origin, 500 URLs max, no JavaScript execution
          </p>
        </section>
        {session.error && (
          <div className="error-banner" role="alert">
            {session.error}
          </div>
        )}
        {!session.scan && (
          <p className="idle-status" role="status">
            No scan loaded. Enter a website URL above. Results stay on this machine.
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
            selectBusy={session.selectBusy}
            onSelectPage={(id) => void session.selectPage(id)}
          />
        )}
      </main>
    </>
  );
}
