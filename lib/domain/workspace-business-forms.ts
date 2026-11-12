import { db } from "@/lib/core/db";

export async function getWorkspaceBusinessBotIds(workspaceId: string | null, fallbackBotId: string) {
  if (!workspaceId) return [fallbackBotId];
  const bots = await db.chatbot.findMany({ where: { workspaceId }, select: { chatbotId: true } });
  return bots.map((bot) => bot.chatbotId);
}

/** Lists a workspace's forms once, while folding legacy bot-level schemas together by slug. */
export async function listWorkspaceBusinessForms(workspaceId: string | null, chatbotIds: string[]) {
  if (chatbotIds.length === 0) return [];

  const schemas = await db.customTableSchema.findMany({
    where: workspaceId
      ? { OR: [{ workspaceId }, { workspaceId: null, chatbotId: { in: chatbotIds } }] }
      : { chatbotId: { in: chatbotIds } },
    include: { _count: { select: { records: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (schemas.length === 0) return [];

  const recordCounts = await db.customRecord.groupBy({
    by: ["schemaId"],
    where: {
      schemaId: { in: schemas.map((schema) => schema.id) },
      chatbotId: { in: chatbotIds },
    },
    _count: { _all: true },
  });
  const slugById = new Map(schemas.map((schema) => [schema.id, schema.slug]));
  const countsBySlug = new Map<string, number>();
  for (const row of recordCounts) {
    const slug = slugById.get(row.schemaId);
    if (slug) countsBySlug.set(slug, (countsBySlug.get(slug) ?? 0) + row._count._all);
  }

  const uniqueBySlug = new Map<string, (typeof schemas)[number]>();
  for (const schema of schemas) {
    if (!uniqueBySlug.has(schema.slug)) uniqueBySlug.set(schema.slug, schema);
  }

  return Array.from(uniqueBySlug.values()).map((schema) => ({
    ...schema,
    _count: { records: countsBySlug.get(schema.slug) ?? 0 },
  }));
}
