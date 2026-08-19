import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelScan as cancelScanRequest,
  createScan,
  getActiveScan,
  getPageDetail,
  listPages,
  type PageDetail,
  type PageSummary,
  type Scan,
  subscribeToScan,
} from "../api";

const SCAN_TOAST_ID = "scan-lifecycle";

function messageFrom(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function useScanSession() {
  const [scan, setScan] = useState<Scan | null>(null);
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [detail, setDetail] = useState<PageDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectBusy, setSelectBusy] = useState(false);
  const [cancelBusyScanId, setCancelBusyScanId] = useState<string | null>(null);
  const cancelRequestRef = useRef(new Map<string, number>());
  const selectionRequest = useRef(0);
  const scanGeneration = useRef(0);
  const scanRef = useRef<Scan | null>(null);
  const pageRefreshScan = useRef(0);
  const pageRefreshRequest = useRef(0);

  useEffect(() => {
    scanRef.current = scan;
  }, [scan]);

  useEffect(() => {
    const generation = scanGeneration.current;
    let mounted = true;
    void getActiveScan()
      .then((active) => {
        if (!mounted || generation !== scanGeneration.current || !active) return;
        setScan(active);
        const requestId = ++pageRefreshRequest.current;
        void listPages(active.id)
          .then((nextPages) => {
            if (mounted && generation === scanGeneration.current && requestId === pageRefreshRequest.current) {
              setPages(nextPages);
            }
          })
          .catch((cause) => {
            if (mounted && generation === scanGeneration.current && requestId === pageRefreshRequest.current) {
              setError(messageFrom(cause));
            }
          });
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const generation = scanGeneration.current;
    const scanRequest = ++pageRefreshScan.current;
    const scanId = scan?.id;
    if (!scanId) return;
    return subscribeToScan(scanId, (event) => {
      if (generation !== scanGeneration.current || scanRef.current?.id !== scanId) return;
      if (event.progress) {
        setScan((current) => (current?.id === scanId ? { ...current, ...event.progress } : current));
      }
      const terminal =
        event.type === "scan_completed" ||
        (event.progress?.status != null && ["completed", "canceled", "failed"].includes(event.progress.status));
      if (terminal) {
        const status = event.progress?.status;
        const progress = event.progress;
        if (status === "completed") {
          toast.success("Scan complete", {
            id: SCAN_TOAST_ID,
            description:
              progress?.discovered != null && progress.discovered > 0
                ? `${progress.completed ?? 0} of ${progress.discovered} pages processed`
                : undefined,
          });
        } else if (status === "failed" || event.type === "scan_error") {
          toast.error("Scan failed", {
            id: SCAN_TOAST_ID,
            description: event.message ?? "An error occurred during the scan",
          });
        } else if (status === "canceled") {
          toast("Scan canceled", { id: SCAN_TOAST_ID });
        }
        void getActiveScan()
          .then((active) => {
            if (generation === scanGeneration.current && scanRef.current?.id === scanId && active?.id === scanId) {
              setScan(active);
            }
          })
          .catch(() => undefined);
      }
      if (!["page_completed", "scan_completed"].includes(event.type)) return;
      const requestId = ++pageRefreshRequest.current;
      void listPages(scanId)
        .then((nextPages) => {
          if (
            generation === scanGeneration.current &&
            scanRef.current?.id === scanId &&
            scanRequest === pageRefreshScan.current &&
            requestId === pageRefreshRequest.current
          ) {
            setPages(nextPages);
          }
        })
        .catch((cause) => {
          if (
            generation === scanGeneration.current &&
            scanRef.current?.id === scanId &&
            scanRequest === pageRefreshScan.current &&
            requestId === pageRefreshRequest.current
          ) {
            setError(messageFrom(cause));
          }
        });
    });
  }, [scan?.id]);

  async function startScan(targetUrl: string, sitemapUrl: string) {
    const generation = ++scanGeneration.current;
    setBusy(true);
    setError(null);
    setDetail(null);
    setSelectedId(null);
    selectionRequest.current += 1;
    try {
      const created = await createScan({ targetUrl, sitemapUrl: sitemapUrl || null });
      if (generation !== scanGeneration.current) return;
      setScan(created);
      setPages([]);
      toast.loading("Scanning…", { id: SCAN_TOAST_ID });
    } catch (cause) {
      if (generation === scanGeneration.current) {
        const msg = messageFrom(cause);
        setError(msg);
        toast.error("Scan could not start", { description: msg });
      }
    } finally {
      setBusy(false);
    }
  }

  async function cancelScan() {
    if (!scan || cancelRequestRef.current.has(scan.id)) return;
    const generation = scanGeneration.current;
    const scanId = scan.id;
    const requestId = (cancelRequestRef.current.get(scanId) ?? 0) + 1;
    cancelRequestRef.current.set(scanId, requestId);
    setCancelBusyScanId(scanId);
    try {
      const canceled = await cancelScanRequest(scanId);
      if (generation === scanGeneration.current && scanRef.current?.id === scanId) setScan(canceled);
    } catch (cause) {
      if (generation === scanGeneration.current && scanRef.current?.id === scanId) {
        const msg = messageFrom(cause);
        setError(msg);
        toast.error("Could not cancel scan", { description: msg });
      }
    } finally {
      if (requestId === cancelRequestRef.current.get(scanId)) {
        cancelRequestRef.current.delete(scanId);
        setCancelBusyScanId((current) => (current === scanId ? null : current));
      }
    }
  }

  async function selectPage(id: string) {
    if (!scan) return;
    const requestId = ++selectionRequest.current;
    const generation = scanGeneration.current;
    const scanId = scan.id;
    const previousId = selectedId;
    setSelectedId(id);
    setSelectBusy(true);
    try {
      const nextDetail = await getPageDetail(scanId, id);
      if (
        requestId === selectionRequest.current &&
        generation === scanGeneration.current &&
        scanRef.current?.id === scanId
      ) {
        setDetail(nextDetail);
      }
    } catch (cause) {
      if (
        requestId === selectionRequest.current &&
        generation === scanGeneration.current &&
        scanRef.current?.id === scanId
      ) {
        const msg = messageFrom(cause);
        setSelectedId(previousId);
        setError(msg);
        toast.error("Could not load page details", { description: msg });
      }
    } finally {
      setSelectBusy(false);
    }
  }

  const cancelBusy = scan ? cancelBusyScanId === scan.id : false;

  return { scan, pages, detail, selectedId, error, busy, selectBusy, cancelBusy, startScan, cancelScan, selectPage };
}
