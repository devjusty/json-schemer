import type { Scan } from "../api";

export function ExportBar({
  scan,
  onCancel,
  cancelBusy = false,
  disabled = false,
}: {
  scan: Scan;
  onCancel: () => void | Promise<void>;
  cancelBusy?: boolean;
  disabled?: boolean;
}) {
  const exportsReady = ["completed", "canceled", "failed"].includes(scan.status);
  const partial = scan.status !== "completed";
  const active = !["completed", "failed", "canceled"].includes(scan.status);

  return (
    <nav className="export-bar" aria-label="Whole-site exports">
      <span>Export site</span>
      {partial && <span className="partial-label">Partial results</span>}
      {(["json", "markdown", "csv"] as const).map((format) =>
        exportsReady ? (
          <a
            key={format}
            href={`/api/scans/${scan.id}/export/${format}`}
            aria-label={`Whole-site ${format === "markdown" ? "Markdown" : format.toUpperCase()}`}
          >
            {format.toUpperCase()}
          </a>
        ) : (
          <span key={format} className="export-disabled" aria-disabled="true" title="Available when scan stops">
            {format.toUpperCase()}
          </span>
        ),
      )}
      {active && (
        <button type="button" disabled={cancelBusy || disabled} onClick={() => void onCancel()}>
          {cancelBusy ? "Canceling..." : "Cancel"}
        </button>
      )}
    </nav>
  );
}
