import { afterEach, describe, expect, it, vi } from "vitest";
import { extractSearchTerms, getContext } from "@/lib/ai/rag";
import { ragRegressionCases } from "@/lib/ai/rag-regression-cases";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/core/db", () => ({ db: { $queryRaw: mocks.queryRaw } }));

describe("RAG retrieval regression cases", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(ragRegressionCases)("$name", async (testCase) => {
    mocks.queryRaw.mockResolvedValue(testCase.candidates);

    expect(extractSearchTerms(testCase.query)).toEqual(testCase.expectedTerms);

    const context = await getContext(
      "chatbot-regression",
      [0.1, 0.2, 0.3],
      10,
      "workspace-regression",
      testCase.query
    );

    if (testCase.expectedEvidence) {
      expect(context).toContain(testCase.expectedEvidence);
    } else {
      expect(context).toBe("");
    }
    if (testCase.rejectedEvidence) {
      expect(context).not.toContain(testCase.rejectedEvidence);
    }

    const [sql, ...parameters] = mocks.queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sqlText = sql.join(" ");
    expect(sqlText).toContain("websearch_to_tsquery");
    expect(sqlText).toContain("SUM(1.0 / (60.0 + CASE");
    expect(sqlText).toContain(`source."ingestionStatus" = 'ready'`);
    expect(sqlText).toContain(`archived_item.archived = true`);
    expect(sqlText).toContain(`archived_item."sourceId" = source."sourceId"`);
    expect(parameters).toContain(testCase.query);
  });
});
