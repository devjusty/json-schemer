import type { PageDetail as PageDetailData, PageSummary, Scan } from "../api";
import { PageDetail } from "./PageDetail";
import { PageTable } from "./PageTable";

export function PageResults({
  scan,
  pages,
  detail,
  selectedId,
  onSelect,
}: {
  scan: Scan;
  pages: PageSummary[];
  detail: PageDetailData | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="results-layout">
      <div>
        <PageTable pages={pages} selectedId={selectedId} onSelect={onSelect} />
      </div>
      {detail ? (
        <PageDetail detail={detail} scanId={scan.id} scanStatus={scan.status} />
      ) : (
        <div className="empty-panel detail-empty">Select page to inspect raw blocks.</div>
      )}
    </section>
  );
}
