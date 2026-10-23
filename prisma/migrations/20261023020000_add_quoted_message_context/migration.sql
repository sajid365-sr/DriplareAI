ALTER TABLE "chatbot"."ChatMessage"
  ADD COLUMN IF NOT EXISTS "replyToMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "replyToSnippet" TEXT,
  ADD COLUMN IF NOT EXISTS "platformMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "ChatMessage_chatbotId_platformMessageId_idx"
  ON "chatbot"."ChatMessage"("chatbotId", "platformMessageId");
