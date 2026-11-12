-- Business records keep their originating chatbotId for audit and session
-- provenance while gaining a Workspace scope for shared reads.
ALTER TABLE "chatbot"."Chatbot"
  ADD COLUMN IF NOT EXISTS "agentRole" TEXT,
  ADD COLUMN IF NOT EXISTS "agentInstructions" JSONB;

ALTER TABLE "app_auth"."Workspace"
  ADD COLUMN IF NOT EXISTS "businessProfile" JSONB;

-- Spreadsheet/e-commerce integration settings are shared across all Agents in
-- a business. Keep chatbotId only as legacy provenance and backfill the owner.
ALTER TABLE "ecommerce"."EcommerceConfig"
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

UPDATE "ecommerce"."EcommerceConfig" AS config
SET "workspaceId" = chatbot."workspaceId"
FROM "chatbot"."Chatbot" AS chatbot
WHERE config."chatbotId" = chatbot."chatbotId"
  AND config."workspaceId" IS NULL;

ALTER TABLE "ecommerce"."EcommerceConfig"
  DROP CONSTRAINT IF EXISTS "EcommerceConfig_chatbotId_fkey";
ALTER TABLE "ecommerce"."EcommerceConfig"
  ALTER COLUMN "chatbotId" DROP NOT NULL;
DROP INDEX IF EXISTS "ecommerce"."EcommerceConfig_chatbotId_key";
CREATE INDEX IF NOT EXISTS "EcommerceConfig_chatbotId_idx"
  ON "ecommerce"."EcommerceConfig"("chatbotId");
CREATE INDEX IF NOT EXISTS "EcommerceConfig_workspaceId_createdAt_idx"
  ON "ecommerce"."EcommerceConfig"("workspaceId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EcommerceConfig_workspaceId_fkey'
      AND connamespace = 'ecommerce'::regnamespace
  ) THEN
    ALTER TABLE "ecommerce"."EcommerceConfig"
      ADD CONSTRAINT "EcommerceConfig_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "app_auth"."Workspace"("workspaceId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "ecommerce"."Product"
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

UPDATE "ecommerce"."Product" AS product
SET "workspaceId" = chatbot."workspaceId"
FROM "chatbot"."Chatbot" AS chatbot
WHERE product."chatbotId" = chatbot."chatbotId"
  AND product."workspaceId" IS NULL
  AND chatbot."workspaceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Product_workspaceId_isActive_idx"
  ON "ecommerce"."Product"("workspaceId", "isActive");

-- Product companion sources are shared operational knowledge. Keep their
-- original chatbotId for provenance, while enabling workspace retrieval.
UPDATE "chatbot"."Source" AS source
SET "workspaceId" = product."workspaceId",
    "isGlobal" = TRUE
FROM "ecommerce"."Product" AS product
WHERE product."sourceId" = source."sourceId"
  AND product."workspaceId" IS NOT NULL;

ALTER TABLE "ecommerce"."Order"
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

UPDATE "ecommerce"."Order" AS business_order
SET "workspaceId" = chatbot."workspaceId"
FROM "chatbot"."Chatbot" AS chatbot
WHERE business_order."chatbotId" = chatbot."chatbotId"
  AND business_order."workspaceId" IS NULL
  AND chatbot."workspaceId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Order_workspaceId_createdAt_idx"
  ON "ecommerce"."Order"("workspaceId", "createdAt");

ALTER TABLE "chatbot"."CustomRecord"
  ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

UPDATE "chatbot"."CustomRecord" AS record
SET "workspaceId" = COALESCE(
  (SELECT schema."workspaceId"
   FROM "chatbot"."CustomTableSchema" AS schema
   WHERE schema."id" = record."schemaId"),
  chatbot."workspaceId"
)
FROM "chatbot"."Chatbot" AS chatbot
WHERE record."chatbotId" = chatbot."chatbotId"
  AND record."workspaceId" IS NULL
  AND COALESCE(
    (SELECT schema."workspaceId"
     FROM "chatbot"."CustomTableSchema" AS schema
     WHERE schema."id" = record."schemaId"),
    chatbot."workspaceId"
  ) IS NOT NULL;

CREATE INDEX IF NOT EXISTS "CustomRecord_workspaceId_createdAt_idx"
  ON "chatbot"."CustomRecord"("workspaceId", "createdAt");

-- Courier credentials were previously unique per user. Preserve each current
-- config and attach an unscoped legacy config to that user's oldest business.
UPDATE "courier"."CourierConfig" AS config
SET "workspaceId" = (
  SELECT workspace."workspaceId"
  FROM "app_auth"."Workspace" AS workspace
  WHERE workspace."userId" = config."userId"
  ORDER BY workspace."createdAt" ASC, workspace."workspaceId" ASC
  LIMIT 1
)
WHERE config."workspaceId" IS NULL;

DROP INDEX IF EXISTS "courier"."CourierConfig_userId_key";
CREATE INDEX IF NOT EXISTS "CourierConfig_userId_idx"
  ON "courier"."CourierConfig"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CourierConfig_workspaceId_key"
  ON "courier"."CourierConfig"("workspaceId");

CREATE TABLE IF NOT EXISTS "ecommerce"."MerchantCoupon" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT,
  "type" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "minOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantCoupon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MerchantCoupon_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "app_auth"."Workspace"("workspaceId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantCoupon_workspaceId_code_key"
  ON "ecommerce"."MerchantCoupon"("workspaceId", "code");
CREATE INDEX IF NOT EXISTS "MerchantCoupon_workspaceId_active_expiresAt_idx"
  ON "ecommerce"."MerchantCoupon"("workspaceId", "active", "expiresAt");
