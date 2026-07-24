// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";

vi.mock("../src/api", () => ({
  createScan: vi.fn(async () => ({ id: "scan-1", targetUrl: "https://example.com", status: "queued" })),
  getActiveScan: vi.fn(async () => null),
  listPages: vi.fn(async () => []),
  getPageDetail: vi.fn(),
  subscribeToScan: vi.fn(() => () => undefined),
  cancelScan: vi.fn(),
}));

afterEach(cleanup);

describe("scanner app", () => {
  it("submits site and optional sitemap URLs", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Website URL"), { target: { value: "https://example.com" } });
    fireEvent.change(screen.getByLabelText("Sitemap URL (optional)"), {
      target: { value: "https://example.com/sitemap.xml" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByText("Scan queued")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Whole-site JSON" })).toHaveAttribute(
      "href",
      "/api/scans/scan-1/export/json",
    );
  });

  it("renders distinct empty state before a scan", () => {
    render(<App />);
    expect(screen.getByText("No scan loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start scan" })).toBeInTheDocument();
  });
});
