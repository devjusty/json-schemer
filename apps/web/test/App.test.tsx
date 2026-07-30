// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

let scanEventCallback: ((event: { type: string; progress?: { status?: string } }) => void) | undefined;

vi.mock("../src/api", () => ({
  createScan: vi.fn(async () => ({ id: "scan-1", targetUrl: "https://example.com", status: "queued" })),
  getActiveScan: vi.fn(async () => null),
  listPages: vi.fn(async () => []),
  getPageDetail: vi.fn(),
  subscribeToScan: vi.fn((_scanId, callback) => {
    scanEventCallback = callback;
    return () => undefined;
  }),
  cancelScan: vi.fn(async () => ({ id: "scan-1", targetUrl: "https://example.com", status: "canceled" })),
}));

afterEach(() => {
  scanEventCallback = undefined;
  cleanup();
  vi.clearAllMocks();
});

describe("scanner app", () => {
  it("submits site and optional sitemap URLs", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "https://example.com" } });
    fireEvent.change(screen.getByLabelText("Sitemap URL (optional)"), {
      target: { value: "https://example.com/sitemap.xml" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByText("Scan queued")).toBeInTheDocument();
    expect(screen.getByText("JSON", { selector: ".export-disabled" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("canceled")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Whole-site JSON" })).toHaveAttribute(
      "href",
      "/api/scans/scan-1/export/json",
    );
  });

  it("enables exports and hides cancel after terminal SSE status", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByText("Scan queued")).toBeInTheDocument();
    expect(screen.getByText("JSON", { selector: ".export-disabled" })).toHaveAttribute("aria-disabled", "true");

    act(() => {
      scanEventCallback?.({ type: "scan_state", progress: { status: "completed" } });
    });

    expect(screen.getByRole("link", { name: "Whole-site JSON" })).toHaveAttribute(
      "href",
      "/api/scans/scan-1/export/json",
    );
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("renders distinct empty state before a scan", () => {
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent(/No scan loaded/);
    expect(screen.getByRole("button", { name: "Start scan" })).toBeInTheDocument();
  });

  it("hydrates website and sitemap fields from the restored active scan", async () => {
    const { getActiveScan } = await import("../src/api");
    vi.mocked(getActiveScan).mockResolvedValueOnce({
      id: "scan-restored",
      targetUrl: "https://restored.example",
      sitemapUrl: "https://restored.example/sitemap.xml",
      status: "completed",
      updatedAt: "2026-07-30T15:14:00.000Z",
    });

    render(<App />);

    expect(await screen.findByDisplayValue("https://restored.example")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://restored.example/sitemap.xml")).toBeInTheDocument();
    expect(screen.getByText("completed", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("restored.example")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "/sitemap.xml" })).toHaveAttribute(
      "href",
      "https://restored.example/sitemap.xml",
    );
    expect(screen.getByRole("link", { name: "/sitemap.xml" })).toHaveAttribute("target", "_blank");
  });
});
