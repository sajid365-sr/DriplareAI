import { db } from "@/lib/core/db";
import type { ChunkMetadata } from "@/lib/ai/rag";

type TrainingProvenance = NonNullable<ChunkMetadata["provenance"]>;

const isPlatform = (value: unknown): value is "facebook" | "whatsapp" | "instagram" =>
  value === "facebook" || value === "whatsapp" || value === "instagram";

function parseProvenance(metadata: unknown): TrainingProvenance | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).provenance;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const provenance = raw as Record<string, unknown>;
  if (typeof provenance.runId !== "string" || !Array.isArray(provenance.evidence)) return null;
  const evidence = provenance.evidence.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (!isPlatform(item.platform) || typeof item.label !== "string" || typeof item.quote !== "string") return [];
    return [{
      platform: item.platform,
      label: item.label,
      quote: item.quote,
      ...(typeof item.agentName === "string" ? { agentName: item.agentName } : {}),
    }];
  });
  return evidence.length > 0 ? { runId: provenance.runId, evidence } : null;
}

export async function getKnowledgeSourceProvenance(
  sourceIds: string[]
): Promise<Map<string, TrainingProvenance>> {
  if (sourceIds.length === 0) return new Map();
  const rows = await db.$queryRaw<Array<{ sourceId: string; metadata: unknown }>>`
    SELECT DISTINCT ON ("sourceId") "sourceId", metadata
    FROM "chatbot"."Chunk"
    WHERE "sourceId" = ANY(${sourceIds}::text[])
      AND metadata ? 'provenance'
    ORDER BY "sourceId", "chunkIndex" ASC
  `;
  return new Map(rows.flatMap((row) => {
    const provenance = parseProvenance(row.metadata);
    return provenance ? [[row.sourceId, provenance] as const] : [];
  }));
}
