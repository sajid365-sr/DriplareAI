import { describe, expect, it } from "vitest";
import { formatBusinessAnswerContent } from "./qa-training-format";

describe("formatBusinessAnswerContent", () => {
  it("renders a grounded answer with its question or situation as response guidance", () => {
    const formatted = formatBusinessAnswerContent(
      "Do you deliver to Dhaka?",
      "Yes, we deliver to Dhaka. Delivery timing depends on the area."
    );

    expect(formatted).toContain("Customer question or situation: Do you deliver to Dhaka?");
    expect(formatted).toContain("Recommended answer: Yes, we deliver to Dhaka.");
    expect(formatted).toContain("grounded answer");
    expect(formatted).toContain("desired response style");
  });

  it("treats a context-free answer as a style example, not a business fact", () => {
    const formatted = formatBusinessAnswerContent("", "Thanks for your patience. I will check this with our team.");

    expect(formatted).toContain("General response example");
    expect(formatted).toContain("response-style example");
    expect(formatted).toContain("Do not treat it as a business fact");
  });
});
