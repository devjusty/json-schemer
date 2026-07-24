import type { Scan } from "../api";

export function ProgressPanel({ scan }: { scan: Scan }) {
  return (
    <section className="progress-panel" aria-label="Scan progress">
      <div>
        <span className="eyebrow">Current scan</span>
        <strong>{scan.status === "queued" ? "Scan queued" : scan.status}</strong>
      </div>
      <div className="progress-grid">
        <span><b>{scan.discovered ?? 0}</b> discovered</span>
        <span><b>{scan.completed ?? 0}</b> completed</span>
        <span><b>{scan.successful ?? 0}</b> with JSON-LD</span>
        <span><b>{scan.failed ?? 0}</b> failed</span>
      </div>
    </section>
  );
}
