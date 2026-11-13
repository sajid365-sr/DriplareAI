CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Chunk_content_search_idx"
  ON "chatbot"."Chunk"
  USING GIN (to_tsvector('simple'::regconfig, "content"));

CREATE INDEX IF NOT EXISTS "Chunk_content_trgm_search_idx"
  ON "chatbot"."Chunk"
  USING GIN ("content" gin_trgm_ops);
