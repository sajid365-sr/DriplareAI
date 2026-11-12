CREATE TABLE IF NOT EXISTS "chatbot"."ConversationLearningJob" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "selections" JSONB NOT NULL,
  "state" JSONB NOT NULL DEFAULT '{}',
  "transcripts" JSONB,
  "drafts" JSONB,
  "error" TEXT,
  "totalConversations" INTEGER NOT NULL DEFAULT 0,
  "processedConversations" INTEGER NOT NULL DEFAULT 0,
  "currentSource" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationLearningJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConversationLearningJob_status_lockedUntil_createdAt_idx"
  ON "chatbot"."ConversationLearningJob"("status", "lockedUntil", "createdAt");
CREATE INDEX IF NOT EXISTS "ConversationLearningJob_workspaceId_userId_createdAt_idx"
  ON "chatbot"."ConversationLearningJob"("workspaceId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConversationLearningJob_expiresAt_idx"
  ON "chatbot"."ConversationLearningJob"("expiresAt");
