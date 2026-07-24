import { describe, expect, it } from "vitest";
import { extractJsonLd } from "../src/jsonld";

describe("JSON-LD extraction", () => {
  it("preserves block order and extracts contexts and types", () => {
    const result = extractJsonLd(`
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"First"}</script>
      <script type="application/ld+json">[{"@type":"Product"},{"@graph":[{"@type":"Offer"}]}]</script>
    `);

    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toMatchObject({
      ordinal: 0,
      parseError: null,
      entities: [{ context: "https://schema.org", types: ["Article"] }],
    });
    expect(result.blocks[1].entities.map((entity) => entity.types)).toEqual([["Product"], ["Offer"]]);
    expect(result.hasValidBlock).toBe(true);
  });

  it("keeps invalid raw blocks and reports parse errors", () => {
    const result = extractJsonLd(
      '<script type="application/ld+json">{"@context":"https://schema.org",</script>',
    );

    expect(result.blocks[0].rawText).toContain("schema.org");
    expect(result.blocks[0].parsed).toBeNull();
    expect(result.blocks[0].parseError).toMatch(/JSON/);
    expect(result.hasValidBlock).toBe(false);
  });

  it("ignores non-JSON-LD scripts", () => {
    const result = extractJsonLd('<script type="application/json">{"ignored":true}</script>');
    expect(result.blocks).toEqual([]);
  });
});
