import { NextResponse } from "next/server";
import { requireAutomationScope } from "@/lib/automations/access";
import { countAudience, resolveAudience } from "@/lib/automations/audience";
import { broadcastAudienceSchema } from "@/lib/automations/schema";
import { z } from "zod";

/**
 * POST /api/automations/broadcasts/audience — "who will this reach?"
 *
 * The composer asks this before every send. Without it, choosing an audience is
 * guesswork: a merchant picks three filters, presses send, and only then
 * discovers the combination matches nobody — or matches everybody.
 *
 * `preview: true` also returns a sample of the actual contacts, which is what
 * catches a filter that is technically correct but obviously wrong ("last seen
 * in 1 day" pulling in the whole customer list).
 */

const requestSchema = z.object({
  chatbotId: z.string().nullable().optional(),
  audience: broadcastAudienceSchema.optional(),
  /** Include a sample of matching contacts, not just the count. */
  preview: z.boolean().default(false),
  sampleSize: z.number().int().min(1).max(50).default(10),
});

export async function POST(req: Request) {
  const result = await requireAutomationScope();
  if (!result.ok) return result.response;
  const { scope } = result;

  try {
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { chatbotId, audience, preview, sampleSize } = parsed.data;

    // An absent audience means "no filter yet", which reaches everyone active.
    // The count is what tells the merchant that is what they just selected.
    const filter = audience ?? broadcastAudienceSchema.parse({});

    if (!preview) {
      const counts = await countAudience({
        workspaceId: scope.workspaceId,
        chatbotId,
        audience: filter,
      });
      return NextResponse.json(counts);
    }

    const resolution = await resolveAudience({
      workspaceId: scope.workspaceId,
      chatbotId,
      audience: filter,
    });

    return NextResponse.json({
      reachable: resolution.members.length,
      archivedExcluded: resolution.archivedExcluded,
      // Unreachable contacts are counted separately: the web widget has no
      // push channel, and a contact whose session id carries no recipient id
      // cannot be delivered to. Reporting them inside `reachable` would promise
      // a delivery that will fail.
      unreachable: resolution.members.filter((member) => member.recipientId === null).length,
      sample: resolution.members.slice(0, sampleSize).map((member) => ({
        chatbotId: member.chatbotId,
        sessionId: member.sessionId,
        platform: member.platform,
      })),
    });
  } catch (error) {
    console.error("[AUTOMATION_BROADCAST_AUDIENCE]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
