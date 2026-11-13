import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Workflow = {
  nodes: Array<{
    name: string;
    onError?: string;
    parameters: Record<string, unknown>;
  }>;
  connections: Record<string, { main?: Array<Array<{ node: string }>> }>;
};

const workflowDirectory = join(process.cwd(), "docs", "n8n-JSON");

function readWorkflow(fileName: string): Workflow {
  return JSON.parse(readFileSync(join(workflowDirectory, fileName), "utf8")) as Workflow;
}

function getNode(workflow: Workflow, name: string) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Missing workflow node: ${name}`);
  return node;
}

describe("source ingestion readiness in n8n workflows", () => {
  it("marks file ingestion ready only after vector writes and records vector failures", () => {
    const workflow = readWorkflow("Source-File-Upload.json");
    const insertQuery = String(getNode(workflow, "Insert into Source").parameters.query);
    const vectorStore = getNode(workflow, "Postgres PGVector Store1");
    const readyQuery = String(getNode(workflow, "Mark Source Ready").parameters.query);
    const failedQuery = String(getNode(workflow, "Mark Source Failed").parameters.query);
    const successResponse = String(getNode(workflow, "Respond to Webhook").parameters.responseBody);
    const failureResponse = String(getNode(workflow, "Respond to Ingestion Error").parameters.responseBody);

    expect(insertQuery).toContain("'processing'");
    expect(vectorStore.onError).toBe("continueErrorOutput");
    expect(workflow.connections["Postgres PGVector Store1"]?.main?.[0]?.[0]?.node).toBe("Mark Source Ready");
    expect(workflow.connections["Postgres PGVector Store1"]?.main?.[1]?.[0]?.node).toBe("Mark Source Failed");
    expect(readyQuery).toContain("'ready'");
    expect(failedQuery).toContain("'failed'");
    expect(successResponse).toContain("success: true");
    expect(failureResponse).toContain("success: false");
  });

  it("retrieves only chunks whose source is ready", () => {
    const workflow = readWorkflow("Core-AI-Brain.json");
    const retrievalQuery = String(getNode(workflow, "RAG Search").parameters.query);
    const filterNode = getNode(workflow, "Filter Relevant Context");
    const filterCode = String(filterNode.parameters.jsCode);

    expect(retrievalQuery).toContain("source.\"ingestionStatus\" = 'ready'");
    expect(retrievalQuery).toContain(`"ingestionStatus" = 'ready'`);
    expect(retrievalQuery).toContain("LIMIT 15");
    expect(retrievalQuery).toContain(`source.name AS "sourceName"`);
    expect(retrievalQuery).toContain("websearch_to_tsquery");
    expect(retrievalQuery).toContain("to_tsvector('simple'::regconfig");
    expect(retrievalQuery).toContain("\\p{M}");
    expect(retrievalQuery).toContain("ILIKE '%' || term.term || '%'");
    expect(retrievalQuery).toContain("SUM(1.0 / (60.0 + CASE");
    expect(filterCode).toContain("Number(row.distance) <= 0.65");
    expect(filterCode).toContain("row.keywordRank !== null");
    expect(filterCode).toContain("hybridScore");
    expect(filterCode).toContain(".slice(0, 10)");
    expect(filterCode).toContain("return contextRows.length ?");
    expect(workflow.connections["RAG Search"]?.main?.[0]?.[0]?.node).toBe("Filter Relevant Context");
    expect(workflow.connections["Filter Relevant Context"]?.main?.[0]?.[0]?.node).toBe("Build Context");
  });

  it("defines GIN indexes used by full-text and exact-term search", () => {
    const migration = readFileSync(
      join(process.cwd(), "prisma", "migrations", "20261113050000_hybrid_knowledge_search", "migration.sql"),
      "utf8"
    );

    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    expect(migration).toContain("USING GIN (to_tsvector('simple'::regconfig, \"content\"))");
    expect(migration).toContain("USING GIN (\"content\" gin_trgm_ops)");
  });
});
