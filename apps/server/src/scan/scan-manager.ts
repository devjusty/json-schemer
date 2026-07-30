import { randomUUID } from "node:crypto";
import type { FetchResult } from "@schemer/crawler";
import { filterSitemapUrls, normalizeUrl } from "@schemer/crawler";
import type { ScanProgress, ScanSettings, ScanStatus } from "@schemer/domain";
import type { JsonLdExtractionResult } from "@schemer/extractor";
import type { Repositories } from "@schemer/storage";
import { PageProcessor } from "./page-processor";

export interface DiscoveredUrl {
  url: string;
  source: string;
}

export interface ScanInput {
  targetUrl: string;
  sitemapUrl: string | null;
  settings: ScanSettings;
}

export interface DiscoveryResult {
  urls: DiscoveredUrl[];
  errors: Array<{ source: string; message: string }>;
}

export interface SitemapDiscoveryOptions {
  maxRedirects: number;
  sameOriginOnly: boolean;
  timeoutMs: number;
  maxResponseBytes: number;
}

export interface ScanDependencies {
  repositories: Repositories;
  discover: (target: URL, sitemapUrl: string | null, options: SitemapDiscoveryOptions) => Promise<DiscoveryResult>;
  fetchPage: (url: string, settings: ScanSettings) => Promise<FetchResult>;
  extract: (html: string) => JsonLdExtractionResult;
}

type ScanEvent =
  | { type: "scan_state"; progress: ScanProgress }
  | { type: "progress"; progress: ScanProgress }
  | { type: "page_completed"; progress: ScanProgress }
  | { type: "scan_completed"; progress: ScanProgress }
  | { type: "scan_error"; progress: ScanProgress; message: string };

type Listener = (event: ScanEvent) => void;

export class ScanManager {
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly activeRuns = new Map<string, Promise<void>>();
  private readonly canceledRuns = new Set<string>();
  private readonly pageProcessor: PageProcessor;
  private sequence = 0;

  constructor(private readonly dependencies: ScanDependencies) {
    this.pageProcessor = new PageProcessor({
      repositories: dependencies.repositories,
      fetchPage: dependencies.fetchPage,
      extract: dependencies.extract,
      createId: randomUUID,
    });
  }

  async start(input: ScanInput) {
    const scanId = `scan-${++this.sequence}`;
    const target = new URL(input.targetUrl);
    const scan = this.dependencies.repositories.replaceActiveScan({
      id: scanId,
      targetUrl: target.href,
      sitemapUrl: input.sitemapUrl,
      settings: input.settings,
    });
    const run = this.run(scanId, target, input);
    this.activeRuns.set(scanId, run);
    void run.finally(() => this.activeRuns.delete(scanId));
    return scan;
  }

  get(scanId: string) {
    const scan = this.dependencies.repositories.getActiveScan();
    return scan?.id === scanId ? scan : null;
  }

  cancel(scanId: string): void {
    this.canceledRuns.add(scanId);
    this.dependencies.repositories.updateScanProgress(scanId, {
      ...this.currentProgress(scanId),
      status: "canceled",
    });
    this.publish(scanId, "scan_state");
  }

  subscribe(scanId: string, listener: Listener): () => void {
    const listeners = this.listeners.get(scanId) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(scanId, listeners);
    return () => listeners.delete(listener);
  }

  async waitForIdle(): Promise<void> {
    await Promise.all(this.activeRuns.values());
  }

  currentProgress(scanId: string): ScanProgress {
    const scan = this.dependencies.repositories.getActiveScan();
    if (!scan || scan.id !== scanId) throw new Error(`Scan not found: ${scanId}`);
    return {
      scanId,
      status: scan.status as ScanStatus,
      discovered: scan.discovered,
      queued: scan.queued,
      completed: scan.completed,
      successful: scan.successful,
      failed: scan.failed,
      sitemapUrl: scan.sitemapUrl,
      updatedAt: scan.updatedAt,
    };
  }

  private publish(scanId: string, event: ScanEvent["type"], message?: string): void {
    const progress = this.currentProgress(scanId);
    const payload = message ? { type: event, progress, message } : { type: event, progress };
    for (const listener of this.listeners.get(scanId) ?? []) listener(payload as ScanEvent);
  }

  private async run(scanId: string, target: URL, input: ScanInput): Promise<void> {
    try {
      this.dependencies.repositories.updateScanProgress(scanId, {
        ...this.currentProgress(scanId),
        status: "discovering",
      });
      this.publish(scanId, "scan_state");
      const discovery = await this.dependencies.discover(target, input.sitemapUrl, {
        maxRedirects: input.settings.maxRedirects,
        sameOriginOnly: input.settings.sameOriginOnly,
        timeoutMs: input.settings.timeoutMs,
        maxResponseBytes: input.settings.maxResponseBytes,
      });
      if (this.canceledRuns.has(scanId)) return;
      if (!input.sitemapUrl) {
        const discoveredSitemap = discovery.urls.map((entry) => entry.source).find((source) => source.length > 0);
        if (discoveredSitemap) {
          this.dependencies.repositories.updateScanSitemapUrl(scanId, discoveredSitemap);
        }
      }
      const urls = filterSitemapUrls(
        discovery.urls.map((entry) => entry.url),
        target,
        input.settings.maxUrls,
      );
      const sourceByUrl = new Map<string, string>();
      for (const entry of discovery.urls) {
        try {
          const normalizedUrl = normalizeUrl(entry.url, target);
          if (!sourceByUrl.has(normalizedUrl)) sourceByUrl.set(normalizedUrl, entry.source);
        } catch {
          // Match filterSitemapUrls: entries outside scan policy are skipped.
        }
      }
      this.dependencies.repositories.updateScanProgress(scanId, {
        ...this.currentProgress(scanId),
        status: "crawling",
        discovered: urls.length,
        queued: urls.length,
      });
      this.publish(scanId, "progress");

      let nextIndex = 0;
      const worker = async (): Promise<void> => {
        while (!this.canceledRuns.has(scanId) && nextIndex < urls.length) {
          const index = nextIndex++;
          const url = urls[index];
          await this.processPage(scanId, url, sourceByUrl.get(url) ?? null, input.settings);
        }
      };
      await Promise.all(Array.from({ length: Math.min(input.settings.concurrency, urls.length || 1) }, worker));

      if (this.canceledRuns.has(scanId)) {
        this.dependencies.repositories.updateScanProgress(scanId, {
          ...this.currentProgress(scanId),
          status: "canceled",
        });
        this.publish(scanId, "scan_state");
        return;
      }

      const progress = this.currentProgress(scanId);
      this.dependencies.repositories.updateScanProgress(scanId, {
        ...progress,
        status: "completed",
      });
      this.publish(scanId, "scan_completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.dependencies.repositories.updateScanProgress(scanId, {
        ...this.currentProgress(scanId),
        status: "failed",
        error: message,
      });
      this.publish(scanId, "scan_error", message);
    }
  }

  private async processPage(
    scanId: string,
    url: string,
    sitemapSource: string | null,
    settings: ScanSettings,
  ): Promise<void> {
    const result = await this.pageProcessor.process(scanId, url, sitemapSource, settings);
    const progress = this.currentProgress(scanId);
    this.dependencies.repositories.updateScanProgress(scanId, {
      ...progress,
      status: this.canceledRuns.has(scanId) ? "canceled" : "crawling",
      completed: progress.completed + 1,
      successful: progress.successful + (result.successful ? 1 : 0),
      failed: progress.failed + (result.successful || result.status === "no_jsonld" ? 0 : 1),
    });
    this.publish(scanId, "page_completed");
  }
}
