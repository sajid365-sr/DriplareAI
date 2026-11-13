CREATE TABLE "chatbot"."ConversationLearningRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "sources" JSONB NOT NULL,
  "totalConversations" INTEGER NOT NULL DEFAULT 0,
  "processedConversations" INTEGER NOT NULL DEFAULT 0,
  "transcriptCount" INTEGER NOT NULL DEFAULT 0,
  "answerDraftCount" INTEGER NOT NULL DEFAULT 0,
  "contentDraftCount" INTEGER NOT NULL DEFAULT 0,
  "failedSources" INTEGER NOT NULL DEFAULT 0,
  "truncatedSources" INTEGER NOT NULL DEFAULT 0,
  "inputTruncated" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "details" JSONB,
  "detailsExpiresAt" TIMESTAMP(3),
  "approvedAnswerCount" INTEGER NOT NULL DEFAULT 0,
  "approvedContentCount" INTEGER NOT NULL DEFAULT 0,
  "failedItems" INTEGER NOT NULL DEFAULT 0,
  "applyStatus" TEXT NOT NULL DEFAULT 'not_applied',
  "savedItems" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConversationLearningRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationLearningRun_workspaceId_createdAt_id_idx"
  ON "chatbot"."ConversationLearningRun"("workspaceId", "createdAt", "id");
CREATE INDEX "ConversationLearningRun_detailsExpiresAt_idx"
  ON "chatbot"."ConversationLearningRun"("detailsExpiresAt");

INSERT INTO "chatbot"."ConversationLearningRun" (
  "id", "workspaceId", "userId", "status", "sources",
  "totalConversations", "processedConversations", "transcriptCount",
  "answerDraftCount", "contentDraftCount", "failedSources", "truncatedSources",
  "inputTruncated", "error", "details", "detailsExpiresAt",
  "approvedAnswerCount", "approvedContentCount", "failedItems", "applyStatus",
  "createdAt", "completedAt", "appliedAt", "updatedAt"
)
SELECT job."id", job."workspaceId", job."userId", job."status", job."selections",
  job."totalConversations", job."processedConversations",
  CASE WHEN job."state"->>'transcriptCount' ~ '^[0-9]+$'
    THEN (job."state"->>'transcriptCount')::INTEGER ELSE 0 END,
  COALESCE(jsonb_array_length(job."drafts"->'faqs'), 0)
    + COALESCE(jsonb_array_length(job."drafts"->'sampleReplies'), 0),
  COALESCE(jsonb_array_length(job."drafts"->'content'), 0),
  COALESCE(jsonb_array_length(job."state"->'failures'), 0),
  CASE WHEN job."state"->>'truncatedSources' ~ '^[0-9]+$'
    THEN (job."state"->>'truncatedSources')::INTEGER ELSE 0 END,
  COALESCE(job."state"->>'inputTruncated' = 'true', false),
  job."error",
  CASE WHEN job."drafts" IS NOT NULL THEN jsonb_build_object('drafts', job."drafts") END,
  CASE WHEN job."drafts" IS NOT NULL THEN CURRENT_TIMESTAMP + INTERVAL '90 days' END,
  COALESCE(CASE WHEN credit_tx.metadata->'appliedCounts'->>'answers' ~ '^[0-9]+$'
    THEN (credit_tx.metadata->'appliedCounts'->>'answers')::INTEGER END, 0),
  COALESCE(CASE WHEN credit_tx.metadata->'appliedCounts'->>'content' ~ '^[0-9]+$'
    THEN (credit_tx.metadata->'appliedCounts'->>'content')::INTEGER END, 0),
  COALESCE(CASE WHEN credit_tx.metadata->>'failedItems' ~ '^[0-9]+$'
    THEN (credit_tx.metadata->>'failedItems')::INTEGER END, 0),
  CASE credit_tx.metadata->>'status'
    WHEN 'applied' THEN 'applied'
    WHEN 'partial' THEN 'partial'
    WHEN 'failed' THEN 'failed'
    ELSE 'not_applied'
  END,
  job."createdAt", job."completedAt",
  CASE WHEN credit_tx.metadata->>'appliedAt' IS NOT NULL
    THEN (credit_tx.metadata->>'appliedAt')::TIMESTAMP(3) END,
  CURRENT_TIMESTAMP
FROM "chatbot"."ConversationLearningJob" job
LEFT JOIN LATERAL (
  SELECT metadata
  FROM "billing"."CreditTransaction"
  WHERE "action_type" = 'auto_train'
    AND metadata->>'runId' = job."id"
  ORDER BY "createdAt" DESC
  LIMIT 1
) credit_tx ON true
ON CONFLICT ("id") DO NOTHING;
