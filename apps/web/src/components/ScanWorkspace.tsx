import type { PageDetail as PageDetailData, PageSummary, Scan } from "../api";
import { ExportBar } from "./ExportBar";
import { PageResults } from "./PageResults";
import { ProgressPanel } from "./ProgressPanel";

export function ScanWorkspace({
  scan,
  pages,
  detail,
  selectedId,
  onCancel,
  cancelBusy,
  busy,
  onSelectPage,
}: {
  scan: Scan;
  pages: PageSummary[];
  detail: PageDetailData | null;
  selectedId: string | null;
  onCancel: () => void;
  cancelBusy: boolean;
  busy: boolean;
  onSelectPage: (id: string) => void;
}) {
  return (
    <>
      <ProgressPanel scan={scan} />
      <ExportBar scan={scan} onCancel={onCancel} cancelBusy={cancelBusy} disabled={busy} />
      <PageResults scan={scan} pages={pages} detail={detail} selectedId={selectedId} onSelect={onSelectPage} />
    </>
  );
}
