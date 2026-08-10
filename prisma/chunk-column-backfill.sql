-- ============================================================================
-- Chunk top-level column backfill  (n8n / langchain ingestion alignment)
-- ============================================================================
-- The in-code ingestion path (lib/ai/rag.ts → addChunksToDb) writes BOTH the
-- top-level columns ("chatbotId", "sourceId", "chunkIndex") AND the standardized
-- metadata JSON. The n8n langchain PGVector node CANNOT set arbitrary columns —
-- it only maps `content` and stores everything else inside the `metadata` JSON
-- ({ "sourceId": ..., "chatbotId": ... }), leaving the top-level columns NULL.
--
-- Retrieval (getContext) matches on EITHER the "chatbotId" column OR
-- metadata->>'chatbotId', so chat works today regardless. This trigger closes the
-- remaining gap so n8n-ingested rows also carry the real columns — keeping the
-- @@index([chatbotId]) useful and letting the Source FK cascade clean up chunks.
--
-- Prisma `db push` does NOT manage triggers, so apply this by hand ONCE against
-- the Neon database (psql or the Neon SQL editor). It is idempotent — safe to
-- re-run after any future `db push`.
-- ============================================================================

-- 1. Trigger function: mirror metadata JSON → top-level columns on insert.
CREATE OR REPLACE FUNCTION chunk_backfill_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- "chatbotId" has no FK — always safe to backfill from metadata.
  IF NEW."chatbotId" IS NULL
     AND NEW.metadata IS NOT NULL
     AND NEW.metadata ? 'chatbotId' THEN
    NEW."chatbotId" := NEW.metadata->>'chatbotId';
  END IF;

  -- "sourceId" is an FK to "Source"("sourceId") with ON DELETE CASCADE.
  -- Only backfill when the referenced Source actually exists, otherwise the
  -- FK would reject an insert that previously succeeded with a NULL sourceId.
  IF NEW."sourceId" IS NULL
     AND NEW.metadata IS NOT NULL
     AND NEW.metadata ? 'sourceId'
     AND EXISTS (
       SELECT 1 FROM "Source" s WHERE s."sourceId" = NEW.metadata->>'sourceId'
     ) THEN
    NEW."sourceId" := NEW.metadata->>'sourceId';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Wire it up (BEFORE INSERT). Drop-then-create keeps this idempotent.
DROP TRIGGER IF EXISTS chunk_backfill_columns_trg ON "Chunk";

CREATE TRIGGER chunk_backfill_columns_trg
  BEFORE INSERT ON "Chunk"
  FOR EACH ROW
  EXECUTE FUNCTION chunk_backfill_columns();

-- 3. One-time backfill for rows already ingested by n8n before this trigger.
UPDATE "Chunk"
SET "chatbotId" = metadata->>'chatbotId'
WHERE "chatbotId" IS NULL
  AND metadata IS NOT NULL
  AND metadata ? 'chatbotId';

UPDATE "Chunk" c
SET "sourceId" = c.metadata->>'sourceId'
WHERE c."sourceId" IS NULL
  AND c.metadata IS NOT NULL
  AND c.metadata ? 'sourceId'
  AND EXISTS (
    SELECT 1 FROM "Source" s WHERE s."sourceId" = c.metadata->>'sourceId'
  );
