import { randomUUID } from "node:crypto";
import type { FetchResult } from "@schemer/crawler";
import type { PageStatus, ScanSettings } from "@schemer/domain";
import type { JsonLdExtractionResult } from "@schemer/extractor";
import type { Repositories } from "@schemer/storage";

export interface PageProcessorDependencies {
  repositories: Repositories;
  fetchPage: (url: string, settings: ScanSettings) => Promise<FetchResult>;
  extract: (html: string) => JsonLdExtractionResult;
  createId?: () => string;
}

export interface PageProcessingResult {
  status: PageStatus;
  successful: boolean;
}

function statusFor(result: FetchResult): "http_error" | "fetch_error" {
  if (result.status === "http_error") return "http_error";
  return "fetch_error";
}

export class PageProcessor {
  private readonly createId: () => string;

  constructor(private readonly dependencies: PageProcessorDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
  }

  async process(
    scanId: string,
    url: string,
    sitemapSource: string | null,
    settings: ScanSettings,
  ): Promise<PageProcessingResult> {
    const result = await this.dependencies.fetchPage(url, settings);
    let status: PageStatus;
    let extraction: JsonLdExtractionResult | null = null;
    let error: string | null = null;

    if (result.status === "ok") {
      try {
        extraction = this.dependencies.extract(result.body);
        status = extraction.blocks.length === 0 ? "no_jsonld" : extraction.hasValidBlock ? "success" : "invalid_jsonld";
      } catch (cause) {
        status = "parse_error";
        error = cause instanceof Error ? cause.message : String(cause);
      }
    } else {
      status = statusFor(result);
      error = result.message;
    }

    const pageInput = {
      id: this.createId(),
      scanId,
      url,
      normalizedUrl: url,
      sitemapSource,
      status,
      httpStatus: result.httpStatus,
      contentType: result.contentType,
      durationMs: result.durationMs,
      error,
    };
    const blocks = [];
    const entities = [];

    if (extraction) {
      for (const block of extraction.blocks) {
        const blockId = this.createId();
        blocks.push({
          id: blockId,
          pageId: pageInput.id,
          ordinal: block.ordinal,
          rawText: block.rawText,
          parsed: block.parsed,
          parseError: block.parseError,
        });
        for (const entity of block.entities) {
          entities.push({
            id: this.createId(),
            blockId,
            context: entity.context,
            types: entity.types,
            serialized: entity.serialized,
          });
        }
      }
    }

    this.dependencies.repositories.persistPage({ page: pageInput, blocks, entities });

    return { status, successful: status === "success" };
  }
}
