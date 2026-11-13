import { read, utils } from "@e965/xlsx";

export const MAX_SPREADSHEET_TEXT_CHARS = 500_000;

export class SpreadsheetIngestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpreadsheetIngestionError";
  }
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).replace(/\u0000/g, "").trim();
  }
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value) ?? "";
}

function uniqueHeaders(values: unknown[], width: number): string[] {
  const seen = new Map<string, number>();

  return Array.from({ length: width }, (_, index) => {
    const base = cellText(values[index]) || `Column ${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function extractExcelKnowledge(
  fileName: string,
  file: Uint8Array
): string {
  let workbook: ReturnType<typeof read>;
  try {
    workbook = read(file, { type: "array", cellDates: true });
  } catch {
    throw new SpreadsheetIngestionError("Could not read this Excel workbook. Verify the file and upload it again.");
  }

  if (workbook.SheetNames.length === 0) {
    throw new SpreadsheetIngestionError("The spreadsheet does not contain any worksheets.");
  }

  const lines = [
    `Workbook: ${fileName.replace(/\u0000/g, "")}`,
    "Rows below are complete records. Worksheet names and field labels are retained for accurate lookup.",
  ];
  let charCount = lines.join("\n").length;
  let recordCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows: unknown[][] = utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (width === 0) continue;

    const headers = uniqueHeaders(rows[0] ?? [], width);
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!row) continue;

      const fields = headers.flatMap((header, index) => {
        const value = cellText(row[index]);
        return value ? [`${header}: ${value}`] : [];
      });
      if (fields.length === 0) continue;

      const line = `Sheet: ${sheetName} | Row ${rowIndex + 1} | ${fields.join(" | ")}`;
      charCount += line.length + 1;
      if (charCount > MAX_SPREADSHEET_TEXT_CHARS) {
        throw new SpreadsheetIngestionError(
          `The spreadsheet exceeds the ${MAX_SPREADSHEET_TEXT_CHARS.toLocaleString()} character ingestion limit. Split it into smaller files and retry.`
        );
      }

      lines.push(line);
      recordCount += 1;
    }
  }

  if (recordCount === 0) {
    throw new SpreadsheetIngestionError("The spreadsheet does not contain any data rows.");
  }

  return lines.join("\n");
}
