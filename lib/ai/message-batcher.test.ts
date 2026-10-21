import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
import {
  extractSenderAndMessage,
  combineMessages,
  mergePayloadWithBatchedText,
  bufferOrDispatchMessage,
  clearActiveBatches,
  getActiveBatchCount,
} from "./message-batcher";

// Mock dedupeAndForward
vi.mock("@/lib/core/webhook-idempotency", () => ({
  dedupeAndForward: vi.fn().mockResolvedValue({
    status: 200,
    body: { received: true, forwarded: true },
    duplicate: false,
    forwarded: true,
  }),
}));

describe("message-batcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearActiveBatches();
  });

  afterEach(() => {
    clearActiveBatches();
    vi.useRealTimers();
  });

  describe("extractSenderAndMessage", () => {
    it("extracts WhatsApp message information correctly", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba_1",
            changes: [
              {
                field: "messages",
                value: {
                  messages: [
                    {
                      from: "8801711223344",
                      id: "wamid.101",
                      text: { body: "What is the price of this shirt?" },
                      type: "text",
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const extracted = extractSenderAndMessage("whatsapp", payload);
      expect(extracted).toEqual({
        senderId: "8801711223344",
        messageId: "wamid.101",
        text: "What is the price of this shirt?",
        sessionId: "wa_8801711223344",
      });
    });

    it("extracts Facebook Messenger message information correctly", () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "page_1",
            messaging: [
              {
                sender: { id: "psid_999" },
                message: {
                  mid: "mid_999",
                  text: "Do you have size L?",
                },
              },
            ],
          },
        ],
      };

      const extracted = extractSenderAndMessage("facebook", payload);
      expect(extracted).toEqual({
        senderId: "psid_999",
        messageId: "mid_999",
        text: "Do you have size L?",
        sessionId: "fb_psid_999",
      });
    });
  });

  describe("combineMessages", () => {
    it("joins multiple text fragments with newlines", () => {
      const texts = ["Hello", "Do you have this dress?", "And in red color?"];
      const combined = combineMessages(texts);
      expect(combined).toBe("Hello\nDo you have this dress?\nAnd in red color?");
    });

    it("filters out empty or whitespace-only messages", () => {
      const texts = ["Hello", "   ", "", "Size M?"];
      const combined = combineMessages(texts);
      expect(combined).toBe("Hello\nSize M?");
    });
  });

  describe("mergePayloadWithBatchedText", () => {
    it("updates text and sets isBatched flag for Facebook", () => {
      const payload = {
        object: "page",
        entry: [
          {
            messaging: [
              {
                sender: { id: "psid_1" },
                message: { mid: "m_1", text: "First" },
              },
            ],
          },
        ],
      };

      const merged = mergePayloadWithBatchedText("facebook", payload, "First\nSecond", 2) as any;
      expect(merged.entry[0].messaging[0].message.text).toBe("First\nSecond");
      expect(merged.entry[0].messaging[0].message.isBatched).toBe(true);
      expect(merged.entry[0].messaging[0].message.batchedCount).toBe(2);
    });

    it("updates text and sets isBatched flag for WhatsApp", () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [{ from: "123", id: "w_1", text: { body: "First" } }],
                },
              },
            ],
          },
        ],
      };

      const merged = mergePayloadWithBatchedText("whatsapp", payload, "First\nSecond", 2) as any;
      expect(merged.entry[0].changes[0].value.messages[0].text.body).toBe("First\nSecond");
      expect(merged.entry[0].changes[0].value.messages[0].text.isBatched).toBe(true);
      expect(merged.entry[0].changes[0].value.messages[0].text.batchedCount).toBe(2);
    });
  });

  describe("bufferOrDispatchMessage", () => {
    it("buffers rapid messages from same user and dispatches single consolidated turn after timer", async () => {
      const payload1 = {
        object: "page",
        entry: [
          {
            messaging: [
              {
                sender: { id: "user_42" },
                message: { mid: "m_1", text: "Hi" },
              },
            ],
          },
        ],
      };

      const payload2 = {
        object: "page",
        entry: [
          {
            messaging: [
              {
                sender: { id: "user_42" },
                message: { mid: "m_2", text: "Do you have shoes?" },
              },
            ],
          },
        ],
      };

      const res1 = await bufferOrDispatchMessage({
        provider: "facebook",
        payload: payload1,
        webhookUrl: "https://test.n8n/webhook",
        logPrefix: "[TEST]",
        windowMs: 3000,
      });

      expect(res1.batched).toBe(true);
      expect(res1.batchSize).toBe(1);
      expect(getActiveBatchCount()).toBe(1);

      // Second message arrives 1 second later
      vi.advanceTimersByTime(1000);

      const res2 = await bufferOrDispatchMessage({
        provider: "facebook",
        payload: payload2,
        webhookUrl: "https://test.n8n/webhook",
        logPrefix: "[TEST]",
        windowMs: 3000,
      });

      expect(res2.batched).toBe(true);
      expect(res2.batchSize).toBe(2);

      // Fast forward past the 3-second window
      vi.advanceTimersByTime(3500);

      expect(getActiveBatchCount()).toBe(0);
    });
  });
});
