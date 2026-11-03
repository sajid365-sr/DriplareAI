CREATE SCHEMA IF NOT EXISTS "app_auth";

-- Older local schemas may have created these models in the default schema
-- before their explicit app_auth mapping was added.
DO $$
BEGIN
  IF to_regclass('"app_auth"."WorkspaceAISettings"') IS NULL
     AND to_regclass('"public"."WorkspaceAISettings"') IS NOT NULL THEN
    ALTER TABLE "public"."WorkspaceAISettings" SET SCHEMA "app_auth";
  END IF;

  IF to_regclass('"app_auth"."AgentAISettings"') IS NULL
     AND to_regclass('"public"."AgentAISettings"') IS NOT NULL THEN
    ALTER TABLE "public"."AgentAISettings" SET SCHEMA "app_auth";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "app_auth"."WorkspaceAISettings" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "corePrompt" TEXT NOT NULL DEFAULT '',
  "rulesJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceAISettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "app_auth"."WorkspaceAISettings"
  ADD COLUMN IF NOT EXISTS "corePrompt" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "rulesJson" JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE "app_auth"."WorkspaceAISettings"
SET "corePrompt" = ''
WHERE "corePrompt" IS NULL;

UPDATE "app_auth"."WorkspaceAISettings"
SET "rulesJson" = '{}'::jsonb
WHERE "rulesJson" IS NULL;

ALTER TABLE "app_auth"."WorkspaceAISettings"
  ALTER COLUMN "corePrompt" SET DEFAULT '',
  ALTER COLUMN "corePrompt" SET NOT NULL,
  ALTER COLUMN "rulesJson" SET DEFAULT '{}'::jsonb,
  ALTER COLUMN "rulesJson" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceAISettings_workspaceId_key"
  ON "app_auth"."WorkspaceAISettings"("workspaceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkspaceAISettings_workspaceId_fkey'
  ) THEN
    ALTER TABLE "app_auth"."WorkspaceAISettings"
      ADD CONSTRAINT "WorkspaceAISettings_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "app_auth"."Workspace"("workspaceId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "app_auth"."AgentAISettings" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "personaPrompt" TEXT NOT NULL,
  "overridesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentAISettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentAISettings_agentId_key"
  ON "app_auth"."AgentAISettings"("agentId");
