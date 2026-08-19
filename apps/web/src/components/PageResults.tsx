import type { PageDetail as PageDetailData, PageSummary, Scan } from "../api";
import { PageDetail } from "./PageDetail";
import { PageTable } from "./PageTable";

export function PageResults({
  scan,
  pages,
  detail,
  selectedId,
  selectBusy,
  onSelect,
}: {
  scan: Scan;
  pages: PageSummary[];
  detail: PageDetailData | null;
  selectedId: string | null;
  selectBusy: boolean;
  onSelect: (id: string) => void;
}) {
  const detailMatchesSelection = detail != null && detail.page.id === selectedId;

  return (
    <section className="results-layout">
      <div>
        <PageTable pages={pages} selectedId={selectedId} onSelect={onSelect} />
      </div>
      {selectBusy && !detailMatchesSelection ? (
        <div className="empty-panel detail-empty" role="status">
          Loading page details.
        </div>
      ) : detailMatchesSelection && detail ? (
        <PageDetail detail={detail} scanId={scan.id} scanStatus={scan.status} />
      ) : (
        <div className="empty-panel detail-empty">Select page to inspect raw blocks.</div>
      )}
    </section>
  );
}
