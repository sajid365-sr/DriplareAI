import { describe, expect, it } from "vitest";

import { pickInboxChatbot, type InboxChatbotCandidate } from "./inbox-chatbot";

const bot = (
  id: string,
  chatbotId: string,
  sessions: number
): InboxChatbotCandidate => ({
  id,
  chatbotId,
  _count: { sessions },
});

// Mirrors `/api/chatbots`: newest first.
const BOTS = [
  bot("row_empty_test", "pub_empty_test", 0),
  bot("row_trendirect", "pub_trendirect", 82),
  bot("row_older", "pub_older", 3),
];

describe("pickInboxChatbot", () => {
  it("honours an active row id", () => {
    expect(pickInboxChatbot(BOTS, "row_empty_test")?.id).toBe("row_empty_test");
  });

  it("honours an active public chatbotId", () => {
    expect(pickInboxChatbot(BOTS, "pub_trendirect")?.id).toBe("row_trendirect");
  });

  it("picks the agent with the most sessions when no id matches", () => {
    // The live failure: `bots[0]` was an empty test agent, so the inbox looked
    // empty even though another agent held 82 conversations.
    expect(pickInboxChatbot(BOTS, null)?.id).toBe("row_trendirect");
  });

  it("keeps the newest agent on a tie", () => {
    const tied = [bot("newest", "pub_newest", 5), bot("older", "pub_older", 5)];

    expect(pickInboxChatbot(tied, null)?.id).toBe("newest");
  });

  it("treats an unknown active id as no preference", () => {
    expect(pickInboxChatbot(BOTS, "deleted_bot")?.id).toBe("row_trendirect");
  });

  it("returns null for an empty list", () => {
    expect(pickInboxChatbot([], "anything")).toBeNull();
  });
});
