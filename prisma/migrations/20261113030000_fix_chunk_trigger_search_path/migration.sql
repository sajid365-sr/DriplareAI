CREATE OR REPLACE FUNCTION public.sync_chunk_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  next_index INTEGER;
BEGIN
  NEW."sourceId" := NEW.metadata->>'sourceId';
  NEW."chatbotId" := NEW.metadata->>'chatbotId';

  SELECT COUNT(*) INTO next_index
  FROM "chatbot"."Chunk"
  WHERE "sourceId" = NEW."sourceId";

  NEW."chunkIndex" := next_index;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.chunk_backfill_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW."chatbotId" IS NULL
     AND NEW.metadata IS NOT NULL
     AND NEW.metadata ? 'chatbotId' THEN
    NEW."chatbotId" := NEW.metadata->>'chatbotId';
  END IF;

  IF NEW."sourceId" IS NULL
     AND NEW.metadata IS NOT NULL
     AND NEW.metadata ? 'sourceId'
     AND EXISTS (
       SELECT 1
       FROM "chatbot"."Source" s
       WHERE s."sourceId" = NEW.metadata->>'sourceId'
     ) THEN
    NEW."sourceId" := NEW.metadata->>'sourceId';
  END IF;

  RETURN NEW;
END;
$function$;
