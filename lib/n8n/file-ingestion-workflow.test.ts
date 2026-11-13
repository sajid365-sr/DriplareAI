import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type WorkflowNode = {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  onError?: string;
};

type Workflow = {
  nodes: WorkflowNode[];
  connections: Record<string, { main?: Array<Array<{ node: string; index: number }>> }>;
};

const readWorkflow = (): Workflow => JSON.parse(
  readFileSync(join(process.cwd(), "docs", "n8n-JSON", "Source-File-Upload.json"), "utf8")
) as Workflow;

const getNode = (workflow: Workflow, name: string): WorkflowNode => {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Missing workflow node: ${name}`);
  return node;
};

describe("file ingestion workflow", () => {
  it("serializes spreadsheet rows as self-contained labeled records", async () => {
    const workflow = readWorkflow();
    const code = String(getNode(workflow, "Normalize Text1").parameters.jsCode);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const normalize = new AsyncFunction("$input", "$", code);
    const result = await normalize(
      {
        all: () => [
          { json: { row: { SKU: "DR-204", Name: "Cotton Panjabi", Price: 1250 } } },
          { json: { row: { SKU: "DR-205", Name: "Linen Shirt", Price: 1800 } } },
        ],
      },
      () => ({
        item: {
          json: {
            fileExtension: "xlsx",
            name: "Catalog.xlsx",
            sourceId: "source-1",
            chatbotId: null,
            workspaceId: "workspace-1",
            isGlobal: true,
            type: "file",
          },
        },
      })
    ) as Array<{ json: { fullText: string; charCount: number } }>;

    expect(result).toHaveLength(1);
    expect(result[0].json.fullText).toContain("Workbook: Catalog.xlsx");
    expect(result[0].json.fullText).toContain("Row 1 | SKU: DR-204 | Name: Cotton Panjabi | Price: 1250");
    expect(result[0].json.fullText).toContain("Row 2 | SKU: DR-205 | Name: Linen Shirt | Price: 1800");
    expect(result[0].json.charCount).toBe(result[0].json.fullText.length);
  });

  it("routes PDFs with no useful embedded text through Gemini OCR", () => {
    const workflow = readWorkflow();
    const pdfTextCheck = getNode(workflow, "PDF Text Extracted?");
    const pdfExtractor = getNode(workflow, "PDF Extractor");
    const ocrRequest = getNode(workflow, "Gemini PDF OCR");
    const ocrText = getNode(workflow, "Extract PDF OCR Text");

    expect(JSON.stringify(pdfTextCheck.parameters)).toContain("length >= 100");
    expect(workflow.connections["PDF Extractor"]?.main?.[0]?.[0]?.node).toBe("PDF Text Extracted?");
    expect(workflow.connections["PDF Text Extracted?"]?.main?.[0]?.[0]?.node).toBe("Normalize Text1");
    expect(workflow.connections["PDF Text Extracted?"]?.main?.[1]?.[0]?.node).toBe("Prepare PDF OCR");
    expect(workflow.connections["Prepare PDF OCR"]?.main?.[0]?.[0]?.node).toBe("Gemini PDF OCR");
    expect(workflow.connections["Gemini PDF OCR"]?.main?.[0]?.[0]?.node).toBe("Extract PDF OCR Text");
    expect(workflow.connections["Extract PDF OCR Text"]?.main?.[0]?.[0]?.node).toBe("Normalize Text1");
    expect(ocrRequest.onError).toBe("continueErrorOutput");
    expect(String(ocrText.parameters.jsCode)).toContain("throw new Error");
    expect(String(ocrText.parameters.jsCode)).toContain("finishReason === 'MAX_TOKENS'");
    expect(String(ocrRequest.parameters.jsonBody)).toContain('"maxOutputTokens": 8192');
    expect(pdfExtractor.parameters.options).toMatchObject({ keepSource: "both", joinPages: true });
  });

  it("uses the pre-extracted all-worksheet text for Excel files", () => {
    const workflow = readWorkflow();
    const generateIds = String(getNode(workflow, "Generate IDs").parameters.jsCode);
    const normalize = String(getNode(workflow, "Normalize Text1").parameters.jsCode);

    expect(generateIds).toContain("body.extractedText");
    expect(normalize).toContain("source.extractedText.trim()");
    expect(workflow.connections["File Type"]?.main?.[1]?.[0]?.node).toBe("Prepared Spreadsheet Text?");
    expect(workflow.connections["File Type"]?.main?.[2]?.[0]?.node).toBe("Prepared Spreadsheet Text?");
    expect(workflow.connections["Prepared Spreadsheet Text?"]?.main?.[0]?.[0]?.node).toBe("Normalize Text1");
    expect(workflow.connections["Prepared Spreadsheet Text?"]?.main?.[1]?.[0]?.node).toBe("Excel Extractor");
  });

  it("uses OCR text and rejects empty or truncated OCR results", async () => {
    const workflow = readWorkflow();
    const code = String(getNode(workflow, "Extract PDF OCR Text").parameters.jsCode);
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
      ...args: string[]
    ) => (...args: unknown[]) => Promise<unknown>;
    const extractOcr = new AsyncFunction("$input", code);
    const input = (text: string, finishReason = "STOP") => {
      const item = { json: { candidates: [{ finishReason, content: { parts: [{ text }] } }] } };
      return { all: () => [item], first: () => item };
    };

    await expect(extractOcr(input("Recognized scanned document text.")))
      .resolves.toMatchObject([{ json: { text: "Recognized scanned document text." } }]);
    await expect(extractOcr(input("", "STOP"))).rejects.toThrow("OCR could not read");
    await expect(extractOcr(input("Partial text", "MAX_TOKENS"))).rejects.toThrow("Split this PDF");
  });
});
