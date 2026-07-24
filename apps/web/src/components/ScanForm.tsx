interface Props {
  targetUrl: string;
  sitemapUrl: string;
  busy: boolean;
  onTargetUrlChange: (value: string) => void;
  onSitemapUrlChange: (value: string) => void;
  onSubmit: () => void;
}

export function ScanForm({ targetUrl, sitemapUrl, busy, onTargetUrlChange, onSitemapUrlChange, onSubmit }: Props) {
  return (
    <form className="scan-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label>
        Website URL
        <input value={targetUrl} onChange={(event) => onTargetUrlChange(event.currentTarget.value)} placeholder="https://example.com" required />
      </label>
      <label>
        Sitemap URL (optional)
        <input value={sitemapUrl} onChange={(event) => onSitemapUrlChange(event.currentTarget.value)} placeholder="Auto-discover from robots.txt" />
      </label>
      <button type="submit" disabled={busy}>{busy ? "Scanning..." : "Start scan"}</button>
    </form>
  );
}
