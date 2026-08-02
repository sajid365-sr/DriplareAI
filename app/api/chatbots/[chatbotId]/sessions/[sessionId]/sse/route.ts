import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export const dynamic = "force-dynamic";

// ── GET /api/chatbots/[chatbotId]/sessions/[sessionId]/sse
// Server-Sent Events stream — pushes AI extraction state updates to the Right Panel
// Client subscribes on mount; receives updates when n8n/AI posts to /extract endpoint
export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; sessionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { chatbotId, sessionId } = await params;
  const encoder = new TextEncoder();

  // Poll DB every 3 seconds and push extraction state to client
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial state immediately
      try {
        const session = await db.chatSession.findFirst({
          where: { chatbotId, sessionId },
          select: { aiExtractionData: true },
        });

        const payload = JSON.stringify(session?.aiExtractionData ?? {});
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch {
        controller.enqueue(encoder.encode(`data: {}\n\n`));
      }

      // Poll for updates every 3 seconds
      const intervalId = setInterval(async () => {
        try {
          const session = await db.chatSession.findFirst({
            where: { chatbotId, sessionId },
            select: { aiExtractionData: true },
          });

          const payload = JSON.stringify(session?.aiExtractionData ?? {});
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Silently ignore DB errors during polling
        }
      }, 3000);

      // Cleanup on client disconnect (30s timeout safety)
      const timeout = setTimeout(() => {
        clearInterval(intervalId);
        controller.close();
      }, 5 * 60 * 1000); // 5 minute max connection

      // Handle client disconnect via abort signal
      req.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        clearTimeout(timeout);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
