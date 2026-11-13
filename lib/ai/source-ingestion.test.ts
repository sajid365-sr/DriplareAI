import { describe, expect, it, vi } from "vitest";
import { splitSourceText } from "@/lib/ai/source-ingestion";

vi.mock("server-only", () => ({}));

describe("splitSourceText", () => {
  it("keeps short but usable source content", async () => {
    await expect(splitSourceText("Store hours: 9 AM to 5 PM.")).resolves.toEqual([
      "Store hours: 9 AM to 5 PM.",
    ]);
  });

  it("does not produce chunks from whitespace-only content", async () => {
    await expect(splitSourceText("   \n\t  ")).resolves.toEqual([]);
  });
});
