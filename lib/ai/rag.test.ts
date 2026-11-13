import { describe, expect, it } from "vitest";
import { extractSearchTerms, formatRelevantContext } from "@/lib/ai/rag";

describe("formatRelevantContext", () => {
  it("keeps only sufficiently relevant chunks and includes their source name", () => {
    const context = formatRelevantContext([
      { content: "Store hours are 9 AM to 5 PM.", sourceName: "Business hours.txt", distance: 0.21 },
      { content: "Unrelated archived notes.", sourceName: "Old notes.txt", distance: 0.82 },
    ]);

    expect(context).toContain("Source: Business hours.txt");
    expect(context).toContain("Store hours are 9 AM to 5 PM.");
    expect(context).not.toContain("Unrelated archived notes.");
  });

  it("returns no context rather than falling back to weak matches", () => {
    expect(formatRelevantContext([
      { content: "Weak semantic match.", sourceName: "Notes.txt", distance: 0.9 },
    ])).toBe("");
  });

  it("keeps a keyword match even when semantic distance is weak", () => {
    const context = formatRelevantContext([
      { content: "SKU DR-204 costs 1,250 BDT.", sourceName: "Catalog.xlsx", distance: 0.91, keywordRank: 1 },
    ]);

    expect(context).toContain("SKU DR-204 costs 1,250 BDT.");
  });

  it("extracts bounded, deduplicated terms without dropping product codes", () => {
    expect(extractSearchTerms("What is the price for SKU-DR_204? sku-dr_204 please"))
      .toEqual(["price", "sku-dr_204"]);
    expect(extractSearchTerms("কুরিয়ার ডেলিভারি চার্জ"))
      .toEqual(["কুরিয়ার", "ডেলিভারি", "চার্জ"]);
  });

  it("respects chunk and context character limits", () => {
    const context = formatRelevantContext([
      { content: "First result.", sourceName: "A", distance: 0.1 },
      { content: "Second result.", sourceName: "B", distance: 0.2 },
    ], 1, 100);

    expect(context).toContain("First result.");
    expect(context).not.toContain("Second result.");
  });
});
