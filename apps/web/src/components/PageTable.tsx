import type { PageSummary } from "../api";

export function PageTable({
  pages,
  selectedId,
  onSelect,
}: {
  pages: PageSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (pages.length === 0) return <div className="empty-panel">Pages appear here as crawl completes.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Status</th>
            <th>HTTP</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id} className={selectedId === page.id ? "selected" : ""} onClick={() => onSelect(page.id)}>
              <td>
                <button
                  className="link-button"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(page.id);
                  }}
                >
                  {page.url}
                </button>
              </td>
              <td>
                <span className={`status status-${page.status}`}>{page.status}</span>
              </td>
              <td className="num">{page.httpStatus ?? "-"}</td>
              <td>{page.error ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
