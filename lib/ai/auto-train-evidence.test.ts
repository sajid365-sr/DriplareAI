import { describe, expect, it } from "vitest";

import { matchEvidence, redactConversationPersonalData } from "./auto-train-evidence";

describe("matchEvidence", () => {
  const transcripts = [{
    platform: "whatsapp",
    label: "WhatsApp conversation abc123",
    agentName: "Support",
    text: "Customer: What is your return policy?\nOwner: Unused items can be returned within seven days.",
  }];

  it("resolves exact evidence to a source and avoids trusting model-provided source labels", () => {
    expect(matchEvidence({
      quote: "Owner: Unused items can be returned within seven days.",
      platform: "facebook",
      label: "Made up",
    }, transcripts)).toEqual({
      platform: "whatsapp",
      label: "WhatsApp conversation abc123",
      agentName: "Support",
      quote: "Owner: Unused items can be returned within seven days.",
    });
  });

  it("accepts whitespace-normalized excerpts from the actual transcript", () => {
    expect(matchEvidence({
      quote: "Customer: What is your return policy?",
    }, transcripts)?.platform).toBe("whatsapp");
  });

  it("rejects invented or too-short excerpts", () => {
    expect(matchEvidence({ quote: "We offer free shipping everywhere." }, transcripts)).toBeNull();
    expect(matchEvidence({ quote: "return" }, transcripts)).toBeNull();
  });

  it("redacts email addresses and phone numbers before conversation processing", () => {
    expect(redactConversationPersonalData("Contact me at merchant@example.com or +880 1712-345678"))
      .toBe("Contact me at [email] or [phone]");
  });
});
