CREATE TABLE IF NOT EXISTS "chatbot"."WebsiteIngestionJob" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "firecrawlJobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'starting',
  "urls" JSONB NOT NULL,
  "processedUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "scrapedPages" INTEGER NOT NULL DEFAULT 0,
  "totalPages" INTEGER NOT NULL DEFAULT 0,
  "processedPages" INTEGER NOT NULL DEFAULT 0,
  "failedPages" INTEGER NOT NULL DEFAULT 0,
  "creditsUsed" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "lockedUntil" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteIngestionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebsiteIngestionJob_status_lockedUntil_createdAt_idx"
  ON "chatbot"."WebsiteIngestionJob"("status", "lockedUntil", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteIngestionJob_workspaceId_userId_createdAt_idx"
  ON "chatbot"."WebsiteIngestionJob"("workspaceId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "WebsiteIngestionJob_expiresAt_idx"
  ON "chatbot"."WebsiteIngestionJob"("expiresAt");
