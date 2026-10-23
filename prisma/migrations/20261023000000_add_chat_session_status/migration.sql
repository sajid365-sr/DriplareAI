-- Add durable Inbox completion and read state without changing existing chats.
ALTER TABLE "chatbot"."ChatSession"
  ADD COLUMN IF NOT EXISTS "isDone" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lastReadAt" TIMESTAMP(3);
