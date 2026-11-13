import { db } from "@/lib/core/db";
import type { Prisma } from "@prisma/client";

/**
 * Standardized shape stored in `Chunk.metadata` for EVERY in-code ingestion path.
 * Keeping this consistent lets retrieval and downstream tooling treat all chunks
 * uniformly regardless of which entity produced them.
 *
 *   type      — what kind of knowledge this chunk represents
 *   sourceId  — the parent Source.sourceId (also mirrored to the top-level column)
 *   chatbotId — owning chatbot (also mirrored to the top-level column)
 *   entityId  — optional id of the originating row (faqId / sampleReplyId / productId)
 */
export type ChunkType = "faq" | "sample_reply" | "product" | "document";

export type ChunkMetadata = {
  type: ChunkType;
  sourceId: string;
  chatbotId?: string;
  workspaceId?: string;
  entityId?: string;
  provenance?: {
    runId: string;
    evidence: Array<{ platform: string; label: string; quote: string; agentName?: string }>;
  };
};

export const MAX_RAG_DISTANCE = 0.65;
export const MAX_RAG_CONTEXT_CHARS = 7000;
export const DEFAULT_RAG_CONTEXT_CHUNKS = 10;
export const MAX_RAG_KEYWORD_TERMS = 12;

const SEARCH_STOP_WORDS = new Set([
  "about", "are", "can", "does", "for", "from", "how", "is", "it", "me", "of",
  "on", "please", "tell", "that", "the", "this", "what", "when", "where", "which",
  "who", "why", "with",
]);

export type RetrievedChunk = {
  content: string;
  sourceName: string | null;
  distance: number | null;
  keywordRank?: number | null;
};

export function extractSearchTerms(query: string): string[] {
  const terms = query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:[-_][\p{L}\p{M}\p{N}]+)*/gu) ?? [];
  return Array.from(new Set(
    terms.filter((term) => term.length >= 3 && !SEARCH_STOP_WORDS.has(term))
  )).slice(0, MAX_RAG_KEYWORD_TERMS);
}

export function formatRelevantContext(
  chunks: RetrievedChunk[],
  limit = DEFAULT_RAG_CONTEXT_CHUNKS,
  maxChars = MAX_RAG_CONTEXT_CHARS,
  maxDistance = MAX_RAG_DISTANCE
): string {
  const selected: string[] = [];
  let usedChars = 0;

  for (const chunk of chunks) {
    const hasSemanticMatch = chunk.distance !== null
      && Number.isFinite(chunk.distance)
      && chunk.distance <= maxDistance;
    const hasKeywordMatch = chunk.keywordRank !== null && chunk.keywordRank !== undefined;
    if ((!hasSemanticMatch && !hasKeywordMatch) || !chunk.content.trim()) {
      continue;
    }

    const sourceLabel = chunk.sourceName?.trim() ? `Source: ${chunk.sourceName.trim()}\n` : "";
    const context = `${sourceLabel}${chunk.content.trim()}`;
    if (selected.length >= limit || usedChars + context.length > maxChars) {
      continue;
    }

    selected.push(`[Context ${selected.length + 1}]\n${context}`);
    usedChars += context.length;
  }

  return selected.join("\n\n");
}

export async function addChunksToDb(
  sourceId: string,
  chatbotId: string | null,
  chunks: string[],
  embeddings: number[][],
  metadata?: Omit<ChunkMetadata, "sourceId" | "chatbotId">,
  client: Pick<Prisma.TransactionClient, "chunk" | "$executeRaw"> = db
) {
  if (chunks.length !== embeddings.length) {
    throw new Error("Chunk and embedding counts do not match");
  }

  // Prisma $executeRaw is used because pgvector Unsupported types can't be created via standard Prisma client create()
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];
    if (!embedding || embedding.length === 0 || !embedding.every(Number.isFinite)) {
      throw new Error(`Invalid embedding for chunk ${i}`);
    }
    const embeddingString = `[${embedding.join(",")}]`;

    // Always populate BOTH the top-level columns AND the standardized metadata JSON,
    // so retrieval works whether it filters on the column (in-code path) or the JSON
    // (n8n / langchain path). type defaults to "document" for generic Sources.
    const chunkMetadata: ChunkMetadata = {
      type: metadata?.type ?? "document",
      sourceId,
      ...(chatbotId ? { chatbotId } : {}),
      ...(metadata?.workspaceId ? { workspaceId: metadata.workspaceId } : {}),
      ...(metadata?.entityId ? { entityId: metadata.entityId } : {}),
      ...(metadata?.provenance ? { provenance: metadata.provenance } : {}),
    };

    // First we create the chunk entry (with columns + metadata), then update the vector.
    const chunkRecord = await client.chunk.create({
      data: {
        sourceId,
        chatbotId,
        content: chunk,
        chunkIndex: i,
        metadata: chunkMetadata,
      },
    });

    // Update with vector
    await client.$executeRaw`
      UPDATE "chatbot"."Chunk"
      SET embedding = ${embeddingString}::vector
      WHERE id = ${chunkRecord.id}
    `;
  }
}

export async function getContext(
  chatbotId: string,
  queryEmbedding: number[],
  limit = DEFAULT_RAG_CONTEXT_CHUNKS,
  workspaceId?: string,
  queryText = ""
): Promise<string> {
  const embeddingString = `[${queryEmbedding.join(",")}]`;
  const candidateLimit = Math.min(Math.max(limit * 3, 15), 60);
  const searchTerms = extractSearchTerms(queryText);

  // Semantic search using cosine distance (<=>).
  // Dual-path chatbot match: in-code chunks set the top-level "chatbotId" column,
  // while n8n/langchain-ingested chunks only carry it inside the metadata JSON.
  // Matching either keeps retrieval consistent across BOTH ingestion pipelines.
  // Skip rows whose embedding never got written (embedding IS NULL) so a partially
  // ingested chunk can't pollute results.
  const chunks = await db.$queryRaw<RetrievedChunk[]>`
    WITH semantic_candidates AS (
      SELECT ranked.id, ranked.content, ranked."sourceName", ranked.distance,
        ranked.result_rank AS "semanticRank", NULL::bigint AS "keywordRank",
        'semantic'::text AS "matchType"
      FROM (
        SELECT chunk.id, chunk.content, source.name AS "sourceName",
          chunk.embedding <=> ${embeddingString}::vector AS distance,
          ROW_NUMBER() OVER (ORDER BY chunk.embedding <=> ${embeddingString}::vector ASC) AS result_rank
        FROM "chatbot"."Chunk" chunk
        JOIN "chatbot"."Source" source
          ON source."sourceId" = COALESCE(chunk."sourceId", chunk.metadata->>'sourceId')
          AND source."ingestionStatus" = 'ready'
        WHERE chunk.embedding IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "chatbot"."WorkspaceKnowledgeItem" archived_item
            WHERE archived_item."sourceId" = source."sourceId"
              AND archived_item.archived = true
          )
          AND (
            chunk."chatbotId" = ${chatbotId}
            OR chunk.metadata->>'chatbotId' = ${chatbotId}
            OR (
              ${workspaceId ?? null}::text IS NOT NULL
              AND source."workspaceId" = ${workspaceId ?? null}
              AND source."isGlobal" = true
            )
          )
        ORDER BY distance ASC
        LIMIT ${candidateLimit}
      ) ranked
    ),
    keyword_candidates AS (
      SELECT ranked.id, ranked.content, ranked."sourceName", NULL::double precision AS distance,
        NULL::bigint AS "semanticRank", ranked.result_rank AS "keywordRank",
        'keyword'::text AS "matchType"
      FROM (
        SELECT chunk.id, chunk.content, source.name AS "sourceName",
          ROW_NUMBER() OVER (
            ORDER BY
              ts_rank_cd(to_tsvector('simple'::regconfig, chunk.content), websearch_to_tsquery('simple'::regconfig, ${queryText})) DESC,
              term_matches.match_count DESC,
              chunk.id
          ) AS result_rank
        FROM "chatbot"."Chunk" chunk
        JOIN "chatbot"."Source" source
          ON source."sourceId" = COALESCE(chunk."sourceId", chunk.metadata->>'sourceId')
          AND source."ingestionStatus" = 'ready'
        CROSS JOIN LATERAL (
          SELECT COUNT(*)::int AS match_count
          FROM unnest(${searchTerms}::text[]) AS search_term(term)
          WHERE char_length(search_term.term) >= 3
            AND chunk.content ILIKE '%' || search_term.term || '%'
        ) term_matches
        WHERE (
            to_tsvector('simple'::regconfig, chunk.content)
              @@ websearch_to_tsquery('simple'::regconfig, ${queryText})
            OR term_matches.match_count > 0
          )
          AND NOT EXISTS (
            SELECT 1
            FROM "chatbot"."WorkspaceKnowledgeItem" archived_item
            WHERE archived_item."sourceId" = source."sourceId"
              AND archived_item.archived = true
          )
          AND (
            chunk."chatbotId" = ${chatbotId}
            OR chunk.metadata->>'chatbotId' = ${chatbotId}
            OR (
              ${workspaceId ?? null}::text IS NOT NULL
              AND source."workspaceId" = ${workspaceId ?? null}
              AND source."isGlobal" = true
            )
          )
        ORDER BY
          ts_rank_cd(to_tsvector('simple'::regconfig, chunk.content), websearch_to_tsquery('simple'::regconfig, ${queryText})) DESC,
          term_matches.match_count DESC,
          chunk.id
        LIMIT ${candidateLimit}
      ) ranked
    ),
    fused_candidates AS (
      SELECT id, MAX(content) AS content, MAX("sourceName") AS "sourceName",
        MIN(distance) AS distance, MIN("keywordRank") AS "keywordRank",
        SUM(1.0 / (60.0 + CASE "matchType"
          WHEN 'semantic' THEN "semanticRank"
          ELSE "keywordRank"
        END)) AS hybrid_score
      FROM (
        SELECT * FROM semantic_candidates
        UNION ALL
        SELECT * FROM keyword_candidates
      ) candidates
      GROUP BY id
    )
    SELECT content, "sourceName", distance, "keywordRank"
    FROM fused_candidates
    ORDER BY hybrid_score DESC, distance ASC NULLS LAST, "keywordRank" ASC NULLS LAST
    LIMIT ${candidateLimit}
  `;

  if (!chunks || chunks.length === 0) {
    return "";
  }

  return formatRelevantContext(chunks, limit);
}
