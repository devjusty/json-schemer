import type { ReactNode } from "react";
import type { PageDetail as PageDetailData, PageSummary, Scan } from "../api";
import { PageDetail } from "./PageDetail";
import { PageTable } from "./PageTable";

function DetailsPane({ branchKey, children }: { branchKey: string; children: ReactNode }) {
  // Enter animation is pure-CSS via @starting-style in styles.css: the
  // `key={branchKey}` below remounts this component on each state change, so
  // the new pane fades in from opacity:0 without JS mount-state to go stale.
  return (
    <div className="details-pane" data-branch={branchKey}>
      {children}
    </div>
  );
}

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
  const branchKey =
    selectBusy && !detailMatchesSelection
      ? "loading"
      : detailMatchesSelection && detail
        ? `detail:${detail.page.id}`
        : "empty";

  const pane =
    selectBusy && !detailMatchesSelection ? (
      <div className="empty-panel detail-empty" role="status">
        Loading page details.
      </div>
    ) : detailMatchesSelection && detail ? (
      <PageDetail detail={detail} scanId={scan.id} scanStatus={scan.status} />
    ) : (
      <div className="empty-panel detail-empty">Select page to inspect raw blocks.</div>
    );

  return (
    <section className="results-layout">
      <div>
        <PageTable pages={pages} selectedId={selectedId} onSelect={onSelect} />
      </div>
      <DetailsPane key={branchKey} branchKey={branchKey}>
        {pane}
      </DetailsPane>
    </section>
  );
}
