ALTER TABLE "chatbot"."Source"
ADD COLUMN IF NOT EXISTS "ingestionStatus" TEXT NOT NULL DEFAULT 'ready';
