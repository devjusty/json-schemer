// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageDetail as PageDetailData, PageSummary, Scan } from "../src/api";
import { ExportBar } from "../src/components/ExportBar";
import { PageResults } from "../src/components/PageResults";
import { PageTable } from "../src/components/PageTable";
import { ScanWorkspace } from "../src/components/ScanWorkspace";

afterEach(() => {
  cleanup();
});

const scan: Scan = { id: "scan-1", targetUrl: "https://example.com", status: "completed" };
const page: PageSummary = {
  id: "page-1",
  url: "https://example.com/page",
  status: "ok",
  httpStatus: 200,
  error: null,
};
const detail: PageDetailData = {
  page: { ...page, normalizedUrl: page.url, contentType: "text/html", durationMs: 10 },
  blocks: [],
  entities: [],
};

describe("web composition components", () => {
  it("renders terminal whole-site exports and hides cancellation", () => {
    render(<ExportBar scan={scan} onCancel={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Whole-site JSON" })).toHaveAttribute(
      "href",
      "/api/scans/scan-1/export/json",
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("composes workspace progress, exports, and page results", () => {
    render(
      <ScanWorkspace
        scan={scan}
        pages={[page]}
        detail={detail}
        selectedId={page.id}
        onCancel={vi.fn()}
        cancelBusy={false}
        busy={false}
        onSelectPage={vi.fn()}
      />,
    );

    expect(screen.getByText("completed", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Whole-site JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: page.url })).toBeInTheDocument();
    expect(screen.getByText("Page detail")).toBeInTheDocument();
  });

  it("composes page table and detail selection", () => {
    const onSelect = vi.fn();
    render(<PageResults scan={scan} pages={[page]} detail={detail} selectedId={page.id} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: page.url }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(page.id);
    expect(screen.getByText("Page detail")).toBeInTheDocument();
  });

  it("selects row once when page link is clicked", () => {
    const onSelect = vi.fn();
    render(<PageTable pages={[page]} selectedId={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: page.url }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(page.id);
  });
});
