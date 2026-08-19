// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageDetail, PageSummary, Scan } from "../src/api";
import { useScanSession } from "../src/hooks/useScanSession";

const api = vi.hoisted(() => ({
  cancelScan: vi.fn(),
  createScan: vi.fn(),
  getActiveScan: vi.fn(),
  getPageDetail: vi.fn(),
  listPages: vi.fn(),
  subscribeToScan: vi.fn(),
}));

vi.mock("../src/api", () => api);

const scan: Scan = { id: "scan-1", targetUrl: "https://example.com", status: "queued" };
const page: PageSummary = { id: "page-1", url: "https://example.com/one", status: "ok", httpStatus: 200, error: null };
const detail: PageDetail = {
  page: { ...page, normalizedUrl: page.url, contentType: "text/html", durationMs: 10 },
  blocks: [],
  entities: [],
};
const secondDetail: PageDetail = { ...detail, page: { ...detail.page, id: "page-2", url: "https://example.com/two" } };

function Harness() {
  const session = useScanSession();
  return createElement(
    "div",
    null,
    createElement(
      "output",
      { "data-testid": "scan" },
      session.scan ? `${session.scan.id}:${session.scan.status}` : "none",
    ),
    createElement("output", { "data-testid": "pages" }, session.pages.length),
    createElement("output", { "data-testid": "selected" }, session.selectedId ?? "none"),
    createElement("output", { "data-testid": "detail" }, session.detail?.page.id ?? "none"),
    createElement("output", { "data-testid": "error" }, session.error ?? "none"),
    createElement("output", { "data-testid": "busy" }, String(session.busy)),
    createElement("output", { "data-testid": "cancel-busy" }, String(session.cancelBusy)),
    createElement(
      "button",
      { type: "button", onClick: () => void session.startScan("https://example.com", "") },
      "start",
    ),
    createElement("button", { type: "button", onClick: () => void session.cancelScan() }, "cancel"),
    createElement("button", { type: "button", onClick: () => void session.selectPage("page-1") }, "select one"),
    createElement("button", { type: "button", onClick: () => void session.selectPage("page-2") }, "select two"),
  );
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("useScanSession", () => {
  it("hydrates active scan and pages", async () => {
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([page]);
    api.subscribeToScan.mockReturnValue(vi.fn());

    render(createElement(Harness));

    expect(await screen.findByTestId("scan")).toHaveTextContent("queued");
    expect(await screen.findByTestId("pages")).toHaveTextContent("1");
    expect(api.listPages).toHaveBeenCalledWith("scan-1");
  });

  it("cleans up SSE subscription when scan changes or unmounts", async () => {
    const unsubscribe = vi.fn();
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(unsubscribe);

    const view = render(createElement(Harness));
    await waitFor(() => expect(api.subscribeToScan).toHaveBeenCalledWith("scan-1", expect.any(Function)));

    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("unsubscribes from the previous scan when scan identity is replaced", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    const unsubscribe = vi.fn();
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.createScan.mockResolvedValue(nextScan);
    api.subscribeToScan.mockReturnValue(unsubscribe);

    render(createElement(Harness));
    await waitFor(() => expect(api.subscribeToScan).toHaveBeenCalledWith("scan-1", expect.any(Function)));

    await act(async () => screen.getByRole("button", { name: "start" }).click());

    expect(api.subscribeToScan).toHaveBeenCalledWith("scan-2", expect.any(Function));
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("does not let hydration overwrite a newer SSE page refresh", async () => {
    let resolveHydratedPages: ((pages: PageSummary[]) => void) | undefined;
    let onEvent: ((event: { type: string; progress?: Partial<Scan> }) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages
      .mockReturnValueOnce(new Promise<PageSummary[]>((resolve) => (resolveHydratedPages = resolve)))
      .mockResolvedValueOnce([page]);
    api.subscribeToScan.mockImplementation((_id: string, callback: typeof onEvent) => {
      onEvent = callback;
      return vi.fn();
    });

    render(createElement(Harness));
    await waitFor(() => expect(onEvent).toBeDefined());

    await act(async () => onEvent?.({ type: "page_completed" }));
    expect(await screen.findByTestId("pages")).toHaveTextContent("1");

    resolveHydratedPages?.([]);
    await act(async () => undefined);
    expect(screen.getByTestId("pages")).toHaveTextContent("1");
  });

  it("refreshes pages for page completion and scan completion events", async () => {
    let onEvent: ((event: { type: string; progress?: Partial<Scan> }) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockImplementation((_id: string, callback: typeof onEvent) => {
      onEvent = callback;
      return vi.fn();
    });

    render(createElement(Harness));
    await waitFor(() => expect(onEvent).toBeDefined());
    api.listPages.mockResolvedValue([page]);

    await act(async () => onEvent?.({ type: "page_completed" }));
    expect(await screen.findByTestId("pages")).toHaveTextContent("1");
    expect(api.listPages).toHaveBeenCalledTimes(2);
  });

  it("ignores stale SSE page refreshes after scan changes", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    let resolveStalePages: ((pages: PageSummary[]) => void) | undefined;
    let onEvent: ((event: { type: string; progress?: Partial<Scan> }) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.createScan.mockResolvedValue(nextScan);
    api.listPages
      .mockImplementationOnce(() => Promise.resolve([]))
      .mockImplementationOnce(() => new Promise<PageSummary[]>((resolve) => (resolveStalePages = resolve)));
    api.subscribeToScan.mockImplementation((_id: string, callback: typeof onEvent) => {
      onEvent = callback;
      return vi.fn();
    });

    render(createElement(Harness));
    await waitFor(() => expect(onEvent).toBeDefined());

    await act(async () => onEvent?.({ type: "page_completed" }));
    await act(async () => screen.getByRole("button", { name: "start" }).click());
    expect(await screen.findByTestId("scan")).toHaveTextContent("queued");

    resolveStalePages?.([page]);
    await act(async () => undefined);
    expect(screen.getByTestId("pages")).toHaveTextContent("0");
  });

  it("ignores stale SSE progress after scan changes", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    const callbacks: Array<(event: { type: string; progress?: Partial<Scan> }) => void> = [];
    api.getActiveScan.mockResolvedValue(scan);
    api.createScan.mockResolvedValue(nextScan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockImplementation(
      (_id: string, callback: (event: { type: string; progress?: Partial<Scan> }) => void) => {
        callbacks.push(callback);
        return vi.fn();
      },
    );

    render(createElement(Harness));
    await waitFor(() => expect(callbacks).toHaveLength(1));
    await act(async () => screen.getByRole("button", { name: "start" }).click());

    await act(async () => callbacks[0]?.({ type: "scan_state", progress: { status: "completed" } }));
    expect(screen.getByTestId("scan")).toHaveTextContent("queued");
  });

  it("ignores stale active-scan hydration after a new scan starts", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    let resolveActive: ((active: Scan) => void) | undefined;
    api.getActiveScan.mockReturnValue(new Promise<Scan>((resolve) => (resolveActive = resolve)));
    api.createScan.mockResolvedValue(nextScan);
    api.listPages.mockResolvedValue([]);

    render(createElement(Harness));
    await act(async () => screen.getByRole("button", { name: "start" }).click());
    resolveActive?.(scan);
    await act(async () => undefined);

    expect(screen.getByTestId("scan")).toHaveTextContent("queued");
  });

  it("ignores stale scan creation responses", async () => {
    const firstScan: Scan = { ...scan, id: "scan-1", status: "queued" };
    const secondScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    let resolveFirst: ((created: Scan) => void) | undefined;
    api.getActiveScan.mockResolvedValue(null);
    api.createScan
      .mockReturnValueOnce(new Promise<Scan>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(secondScan);

    render(createElement(Harness));
    await act(async () => {
      screen.getByRole("button", { name: "start" }).click();
      screen.getByRole("button", { name: "start" }).click();
    });
    expect(screen.getByTestId("scan")).toHaveTextContent("scan-2");
    resolveFirst?.(firstScan);
    await act(async () => undefined);

    expect(screen.getByTestId("scan")).toHaveTextContent("queued");
    expect(screen.getByTestId("selected")).toHaveTextContent("none");
  });

  it("reports detail loading errors", async () => {
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.getPageDetail.mockRejectedValue(new Error("detail unavailable"));

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));
    await act(async () => screen.getByRole("button", { name: "select one" }).click());

    expect(await screen.findByTestId("error")).toHaveTextContent("detail unavailable");
    expect(screen.getByTestId("selected")).toHaveTextContent("none");
    expect(screen.getByTestId("detail")).toHaveTextContent("none");
  });

  it("reports scan creation errors and clears busy state", async () => {
    api.getActiveScan.mockResolvedValue(null);
    api.createScan.mockRejectedValue(new Error("cannot create"));

    render(createElement(Harness));
    await act(async () => screen.getByRole("button", { name: "start" }).click());

    expect(await screen.findByTestId("error")).toHaveTextContent("cannot create");
    expect(screen.getByTestId("busy")).toHaveTextContent("false");
  });

  it("reports cancellation errors", async () => {
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.cancelScan.mockRejectedValue(new Error("cannot cancel"));

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));
    await act(async () => screen.getByRole("button", { name: "cancel" }).click());

    expect(await screen.findByTestId("error")).toHaveTextContent("cannot cancel");
  });

  it("prevents duplicate cancellation while cancellation is in flight", async () => {
    let resolveCancel: ((result: Scan) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.cancelScan.mockReturnValue(new Promise<Scan>((resolve) => (resolveCancel = resolve)));

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));
    await act(async () => {
      screen.getByRole("button", { name: "cancel" }).click();
      screen.getByRole("button", { name: "cancel" }).click();
    });

    expect(api.cancelScan).toHaveBeenCalledOnce();
    expect(screen.getByTestId("cancel-busy")).toHaveTextContent("true");
    resolveCancel?.({ ...scan, status: "canceled" });
    await act(async () => undefined);
    expect(screen.getByTestId("cancel-busy")).toHaveTextContent("false");
  });

  it("ignores stale cancellation responses after a new scan starts", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    let resolveCancel: ((result: Scan) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.cancelScan.mockReturnValue(new Promise<Scan>((resolve) => (resolveCancel = resolve)));
    api.createScan.mockResolvedValue(nextScan);

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));
    await act(async () => screen.getByRole("button", { name: "cancel" }).click());
    await act(async () => screen.getByRole("button", { name: "start" }).click());
    resolveCancel?.({ ...scan, status: "canceled" });
    await act(async () => undefined);

    expect(screen.getByTestId("scan")).toHaveTextContent("queued");
  });

  it("prevents canceling the old scan while a new scan is being created", async () => {
    let resolveCreate: ((result: Scan) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.cancelScan.mockReturnValue(new Promise<Scan>(() => undefined));
    api.createScan.mockReturnValue(new Promise<Scan>((resolve) => (resolveCreate = resolve)));

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));

    await act(async () => screen.getByRole("button", { name: "cancel" }).click());
    await act(async () => screen.getByRole("button", { name: "start" }).click());
    await act(async () => screen.getByRole("button", { name: "cancel" }).click());

    expect(api.cancelScan).toHaveBeenCalledOnce();
    resolveCreate?.({ ...scan, id: "scan-2" });
  });

  it("allows canceling a new scan while the old scan cancellation is pending", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    let resolveOldCancel: ((result: Scan) => void) | undefined;
    let resolveNewCancel: ((result: Scan) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.createScan.mockResolvedValue(nextScan);
    api.cancelScan.mockImplementation((scanId: string) => {
      return new Promise<Scan>((resolve) => {
        if (scanId === "scan-1") resolveOldCancel = resolve;
        else resolveNewCancel = resolve;
      });
    });

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));

    await act(async () => screen.getByRole("button", { name: "cancel" }).click());
    await act(async () => screen.getByRole("button", { name: "start" }).click());
    await act(async () => screen.getByRole("button", { name: "cancel" }).click());

    expect(api.cancelScan).toHaveBeenNthCalledWith(1, "scan-1");
    expect(api.cancelScan).toHaveBeenNthCalledWith(2, "scan-2");
    expect(screen.getByTestId("cancel-busy")).toHaveTextContent("true");

    resolveOldCancel?.({ ...scan, status: "canceled" });
    await act(async () => undefined);
    expect(screen.getByTestId("scan")).toHaveTextContent("scan-2:queued");
    expect(screen.getByTestId("cancel-busy")).toHaveTextContent("true");

    resolveNewCancel?.({ ...nextScan, status: "canceled" });
    await act(async () => undefined);
    expect(screen.getByTestId("scan")).toHaveTextContent("scan-2:canceled");
    expect(screen.getByTestId("cancel-busy")).toHaveTextContent("false");
  });

  it("ignores stale detail responses", async () => {
    let resolveFirst: ((value: PageDetail) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.getPageDetail.mockImplementation((_scanId: string, pageId: string) =>
      pageId === "page-1"
        ? new Promise<PageDetail>((resolve) => (resolveFirst = resolve))
        : Promise.resolve(secondDetail),
    );

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));
    await act(async () => {
      screen.getByRole("button", { name: "select one" }).click();
      screen.getByRole("button", { name: "select two" }).click();
    });
    resolveFirst?.(detail);
    await act(async () => undefined);
    expect(screen.getByTestId("selected")).toHaveTextContent("page-2");
    expect(screen.getByTestId("detail")).toHaveTextContent("page-2");
  });

  it("ignores stale detail responses after a new scan starts", async () => {
    const nextScan: Scan = { ...scan, id: "scan-2", status: "queued" };
    let resolveDetail: ((value: PageDetail) => void) | undefined;
    api.getActiveScan.mockResolvedValue(scan);
    api.listPages.mockResolvedValue([]);
    api.subscribeToScan.mockReturnValue(vi.fn());
    api.getPageDetail.mockReturnValue(new Promise<PageDetail>((resolve) => (resolveDetail = resolve)));
    api.createScan.mockResolvedValue(nextScan);

    render(createElement(Harness));
    await waitFor(() => expect(screen.getByTestId("scan")).toHaveTextContent("queued"));
    await act(async () => screen.getByRole("button", { name: "select one" }).click());
    await act(async () => screen.getByRole("button", { name: "start" }).click());
    resolveDetail?.(detail);
    await act(async () => undefined);

    expect(screen.getByTestId("detail")).toHaveTextContent("none");
  });
});
