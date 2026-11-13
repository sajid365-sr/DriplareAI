CREATE TABLE IF NOT EXISTS "chatbot"."WebsiteDiscoveredPage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "siteUrl" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "jobId" TEXT,
  "sourceId" TEXT,
  "lastError" TEXT,
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "crawledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebsiteDiscoveredPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteDiscoveredPage_workspaceId_url_key"
  ON "chatbot"."WebsiteDiscoveredPage"("workspaceId", "url");
CREATE INDEX IF NOT EXISTS "WebsiteDiscoveredPage_workspaceId_siteUrl_status_idx"
  ON "chatbot"."WebsiteDiscoveredPage"("workspaceId", "siteUrl", "status");
CREATE INDEX IF NOT EXISTS "WebsiteDiscoveredPage_workspaceId_userId_discoveredAt_idx"
  ON "chatbot"."WebsiteDiscoveredPage"("workspaceId", "userId", "discoveredAt");
CREATE INDEX IF NOT EXISTS "WebsiteDiscoveredPage_jobId_idx"
  ON "chatbot"."WebsiteDiscoveredPage"("jobId");
