import { db } from "@/lib/db";
import { openRouter } from "@/lib/embeddings";

/**
 * Analyzes a chat session using AI to extract sentiment and topic.
 * This can be called after a session has a few messages or periodically.
 */
export async function analyzeSession(chatbotId: string, sessionId: string) {
  try {
    const session = await db.chatSession.findUnique({
      where: { chatbotId_sessionId: { chatbotId, sessionId } },
      include: { 
        messages: { 
          orderBy: { timestamp: "asc" }, 
          take: 20 // Analyze last 20 messages for context
        } 
      }
    });

    if (!session || session.messages.length < 2) return;

    // Only analyze if not analyzed recently (e.g. within last 5 messages)
    // Or just analyze every time for now as it's small scale
    
    const conversation = session.messages.map(m => `${m.role}: ${m.content}`).join("\n");

    const prompt = `You are an expert conversation analyzer. Analyze the following chat conversation between an AI assistant and a user.
Return a JSON object with EXACTLY these two fields:
1. "sentiment": One of "positive", "neutral", or "negative".
2. "topic": A short (2-3 words) description of the main subject.

Conversation:
${conversation}`;

    const completion = await openRouter.chat.completions.create({
      model: "google/gemini-2.0-flash-lite-001",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return;

    const result = JSON.parse(content);

    if (result.sentiment || result.topic) {
      await db.chatSession.update({
        where: { id: session.id },
        data: {
          sentiment: result.sentiment?.toLowerCase(),
          topic: result.topic,
          analysisAt: new Date()
        }
      });
      console.log(`[ANALYTICS] Session ${sessionId} analyzed: ${result.sentiment}, ${result.topic}`);
    }
  } catch (error) {
    console.error("[ANALYZE_SESSION_ERROR]", error);
  }
}
