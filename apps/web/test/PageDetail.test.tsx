// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PageDetail as PageDetailData } from "../src/api";
import { PageDetail } from "../src/components/PageDetail";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const detail: PageDetailData = {
  page: {
    id: "page-1",
    url: "https://example.com/page",
    normalizedUrl: "https://example.com/page",
    status: "200",
    httpStatus: 200,
    contentType: "text/html",
    durationMs: 10,
    error: null,
  },
  blocks: [
    { id: "block-1", ordinal: 1, rawText: '{"broken":', parsed: null, parseError: "Unexpected end" },
    { id: "block-2", ordinal: 2, rawText: '{"@type":"Thing"}', parsed: { "@type": "Thing" }, parseError: null },
  ],
  entities: [
    { id: "entity-1", blockId: "block-2", context: "https://schema.org", types: ["WebPage"], serialized: "{}" },
    { id: "entity-2", blockId: "block-2", context: "https://schema.org", types: ["Organization"], serialized: "{}" },
  ],
};

describe("PageDetail", () => {
  it("copies exact raw JSON-LD text and confirms successful copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<PageDetail detail={detail} scanId="scan-1" scanStatus="completed" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON-LD block 1" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"broken":');
    expect(await screen.findByRole("button", { name: "Copied JSON-LD block 1" })).toBeInTheDocument();
  });

  it("does not show copied when clipboard write is rejected", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<PageDetail detail={detail} scanId="scan-1" scanStatus="completed" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON-LD block 1" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith('{"broken":');
    expect(screen.getByRole("button", { name: "Copy JSON-LD block 1" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Unable to copy. Check clipboard permission and try again.");
  });

  it("keeps latest copied confirmation until its timer expires", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<PageDetail detail={detail} scanId="scan-1" scanStatus="completed" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON-LD block 1" }));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON-LD block 2" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Copied JSON-LD block 2" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Copied JSON-LD block 2" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button", { name: "Copy JSON-LD block 2" })).toBeInTheDocument();
  });

  it("renders schema type pills for extracted entities", () => {
    render(<PageDetail detail={detail} scanId="scan-1" scanStatus="completed" />);

    const pills = screen.getAllByText(/WebPage|Organization/);
    expect(pills).toHaveLength(2);
    expect(pills[0]).toHaveClass("schema-type-pill");
    expect(pills[1]).toHaveClass("schema-type-pill");
  });

  it("does not render schema type pills when no entities", () => {
    const detailNoEntities: PageDetailData = {
      ...detail,
      entities: [],
    };
    render(<PageDetail detail={detailNoEntities} scanId="scan-1" scanStatus="completed" />);

    expect(screen.queryByText(/WebPage/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Organization/)).not.toBeInTheDocument();
  });
});
