import * as cheerio from "cheerio";

export interface ExtractedJsonLdEntity {
  context: string | null;
  types: string[];
  serialized: string;
}

export interface ExtractedJsonLdBlock {
  ordinal: number;
  rawText: string;
  parsed: unknown | null;
  parseError: string | null;
  entities: ExtractedJsonLdEntity[];
}

export interface JsonLdExtractionResult {
  blocks: ExtractedJsonLdBlock[];
  hasValidBlock: boolean;
}

function asTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function asContext(value: unknown): string | null {
  if (typeof value === "string") return value;
  return value == null ? null : JSON.stringify(value);
}

function entitiesFrom(value: unknown): ExtractedJsonLdEntity[] {
  if (Array.isArray(value)) return value.flatMap(entitiesFrom);
  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;
  if (Array.isArray(object["@graph"])) return object["@graph"].flatMap(entitiesFrom);

  return [
    {
      context: asContext(object["@context"]),
      types: asTypes(object["@type"]),
      serialized: JSON.stringify(value),
    },
  ];
}

export function extractJsonLd(html: string): JsonLdExtractionResult {
  const $ = cheerio.load(html, { xml: false });
  const blocks: ExtractedJsonLdBlock[] = [];

  $("script[type='application/ld+json']").each((index, element) => {
    const rawText = $(element).html() ?? "";
    try {
      const parsed = JSON.parse(rawText);
      blocks.push({
        ordinal: index,
        rawText,
        parsed,
        parseError: null,
        entities: entitiesFrom(parsed),
      });
    } catch (error) {
      blocks.push({
        ordinal: index,
        rawText,
        parsed: null,
        parseError: `JSON-LD parse error: ${error instanceof Error ? error.message : String(error)}`,
        entities: [],
      });
    }
  });

  return { blocks, hasValidBlock: blocks.some((block) => block.parseError === null) };
}
