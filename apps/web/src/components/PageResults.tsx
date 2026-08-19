import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { PageDetail as PageDetailData, PageSummary, Scan } from "../api";
import { PageDetail } from "./PageDetail";
import { PageTable } from "./PageTable";

function DetailsPane({ branchKey, children }: { branchKey: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // `branchKey` is carried on the <DetailsPane key={branchKey}> below: each
  // state change unmounts/remounts this component, resetting `mounted` to
  // false so the incoming content fades in from its entry state.
  useEffect(() => {
    setMounted(true);
  }, []);

  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  const style: CSSProperties = reduced
    ? {}
    : {
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(2px)",
        transition: "opacity 150ms var(--ease-out), transform 150ms var(--ease-out)",
      };

  return (
    <div data-branch={branchKey} style={style}>
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
