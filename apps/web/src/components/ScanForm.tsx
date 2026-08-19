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
    <form
      className="scan-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        Website URL
        <input
          name="url"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={targetUrl}
          onChange={(event) => onTargetUrlChange(event.currentTarget.value)}
          placeholder="https://example.com"
          required
        />
      </label>
      <label>
        Sitemap URL (optional)
        <input
          name="sitemapUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={sitemapUrl}
          onChange={(event) => onSitemapUrlChange(event.currentTarget.value)}
          placeholder="https://example.com/sitemap.xml"
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Scanning..." : "Start scan"}
      </button>
    </form>
  );
}
