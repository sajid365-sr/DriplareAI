ALTER TABLE "chatbot"."ChatSession"
  ADD COLUMN IF NOT EXISTS "assignmentNote" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentAiPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "assignmentAiResumeAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ChatSession_assignmentAiPaused_assignmentAiResumeAt_idx"
  ON "chatbot"."ChatSession"("assignmentAiPaused", "assignmentAiResumeAt");
