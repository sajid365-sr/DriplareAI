import { utils, write, type BookType } from "@e965/xlsx";
import { describe, expect, it } from "vitest";
import { extractExcelKnowledge } from "@/lib/ai/spreadsheet-ingestion";

function workbookBytes(
  workbook: ReturnType<typeof utils.book_new>,
  bookType: BookType = "xlsx"
): Uint8Array {
  const output: unknown = write(workbook, { type: "array", bookType });
  if (!(output instanceof ArrayBuffer)) {
    throw new Error("The XLSX fixture was not serialized as an ArrayBuffer.");
  }
  return new Uint8Array(output);
}

describe("extractXlsxKnowledge", () => {
  it("extracts labeled rows from every worksheet", () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([
      ["SKU", "Name", "Price"],
      ["DR-204", "Cotton Panjabi", 1250],
      ["DR-205", "Linen Shirt", 1800],
    ]), "Catalog");
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([
      ["Region", "Fee"],
      ["Outside Dhaka", 120],
    ]), "Delivery");

    const text = extractExcelKnowledge("merchant.xlsx", workbookBytes(workbook));

    expect(text).toContain("Workbook: merchant.xlsx");
    expect(text).toContain("Sheet: Catalog | Row 2 | SKU: DR-204 | Name: Cotton Panjabi | Price: 1250");
    expect(text).toContain("Sheet: Delivery | Row 2 | Region: Outside Dhaka | Fee: 120");
  });

  it("preserves duplicate and blank column headings", () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([
      ["Name", "Name", ""],
      ["First", "Preferred", "Value"],
    ]), "Sheet 1");

    const text = extractExcelKnowledge("custom-fields.xlsx", workbookBytes(workbook));

    expect(text).toContain("Name: First | Name (2): Preferred | Column 3: Value");
  });

  it("extracts legacy XLS workbooks too", () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([
      ["SKU", "Price"],
      ["DR-301", 950],
    ]), "Legacy Catalog");

    const text = extractExcelKnowledge("legacy.xls", workbookBytes(workbook, "xls"));

    expect(text).toContain("Sheet: Legacy Catalog | Row 2 | SKU: DR-301 | Price: 950");
  });

  it("rejects workbooks without data rows", () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([["Header"]]), "Empty");

    expect(() => extractExcelKnowledge("empty.xlsx", workbookBytes(workbook)))
      .toThrow("does not contain any data rows");
  });
});
