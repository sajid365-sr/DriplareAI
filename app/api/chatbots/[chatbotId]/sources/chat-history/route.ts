import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { createSourceWithEmbeddings } from "@/lib/ai/source-ingestion";

// ─── Types ────────────────────────────────────────────────────────────────────

type QAPair = {
  question: string;
  answer: string;
};

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Parse a CSV file with two columns: Customer Question & Admin/Owner Answer.
 * Accepts headers like: question, customer, user, message, customer_message, input
 * and: answer, admin, owner, reply, response, admin_reply, output
 */
function parseCsvToQAPairs(csvText: string): QAPair[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase().split(",").map((h) => h.replace(/^"|"$/g, "").trim());

  const questionIdx = headers.findIndex((h) =>
    ["question", "customer", "user", "message", "customer_message", "input", "q"].includes(h)
  );
  const answerIdx = headers.findIndex((h) =>
    ["answer", "admin", "owner", "reply", "response", "admin_reply", "output", "a"].includes(h)
  );

  if (questionIdx === -1 || answerIdx === -1) {
    // Fallback: treat first column as question, second as answer
    return lines.slice(1).reduce<QAPair[]>((acc, line) => {
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      if (cols[0] && cols[1]) acc.push({ question: cols[0], answer: cols[1] });
      return acc;
    }, []);
  }

  return lines.slice(1).reduce<QAPair[]>((acc, line) => {
    // Handle quoted commas inside CSV fields
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) =>
      c.replace(/^"|"$/g, "").trim()
    ) ?? line.split(",").map((c) => c.trim());

    const q = cols[questionIdx];
    const a = cols[answerIdx];
    if (q && a) acc.push({ question: q, answer: a });
    return acc;
  }, []);
}

/**
 * Parse a JSON file. Accepts:
 * - Array of { question, answer } (or similar key variations)
 * - Facebook Messenger export format: { messages: [ { sender_name, content } ] }
 */
function parseJsonToQAPairs(jsonData: unknown): QAPair[] {
  if (!Array.isArray(jsonData) && typeof jsonData !== "object") return [];

  // Facebook Messenger export format
  const raw = jsonData as Record<string, unknown>;
  if (Array.isArray(raw?.messages)) {
    const msgs = raw.messages as Array<{ sender_name?: string; content?: string }>;
    const pairs: QAPair[] = [];
    for (let i = 0; i < msgs.length - 1; i++) {
      const curr = msgs[i];
      const next = msgs[i + 1];
      // Pair customer msg with admin reply (admin is second sender in conversation)
      if (curr?.content && next?.content && curr.sender_name !== next.sender_name) {
        pairs.push({ question: curr.content, answer: next.content });
        i++; // Skip next since it's the paired answer
      }
    }
    return pairs;
  }

  // Standard array format: [{ question, answer }, ...]
  if (Array.isArray(jsonData)) {
    return (jsonData as Array<Record<string, string>>).reduce<QAPair[]>((acc, item) => {
      const q =
        item?.question ?? item?.q ?? item?.customer ?? item?.user ?? item?.message ?? item?.input;
      const a =
        item?.answer ?? item?.a ?? item?.admin ?? item?.owner ?? item?.reply ?? item?.response ?? item?.output;
      if (q && a) acc.push({ question: String(q), answer: String(a) });
      return acc;
    }, []);
  }

  return [];
}

/**
 * Convert QA pairs into a clean text format for vector embedding.
 * Each pair is formatted as a self-contained conversation block.
 */
function qaPairsToText(pairs: QAPair[]): string {
  return pairs
    .map(
      (pair, i) =>
        `[Conversation ${i + 1}]\nCustomer: ${pair.question}\nOwner: ${pair.answer}`
    )
    .join("\n\n");
}

// ─── API Route ────────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "json"].includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Only .csv and .json files are supported for chat history." },
        { status: 400 }
      );
    }

    const fileText = await file.text();
    let pairs: QAPair[] = [];

    if (ext === "csv") {
      pairs = parseCsvToQAPairs(fileText);
    } else if (ext === "json") {
      try {
        const jsonData = JSON.parse(fileText);
        pairs = parseJsonToQAPairs(jsonData);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON file format." },
          { status: 400 }
        );
      }
    }

    if (pairs.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid Q&A pairs found in the file. Make sure your CSV has 'question' and 'answer' columns, or your JSON has the correct format.",
        },
        { status: 400 }
      );
    }

    // Convert pairs to embeddable text
    const trainingText = qaPairsToText(pairs);

    // Create Source + Chunks + Embeddings
    const source = await createSourceWithEmbeddings({
      chatbotId,
      type: "text", // Reuse existing text type — no schema change needed
      name: `[Chat History] ${file.name} (${pairs.length} conversations)`,
      content: trainingText,
    });

    console.log(
      `[CHAT_HISTORY] Ingested ${pairs.length} Q&A pairs from "${file.name}" for chatbot ${chatbotId}`
    );

    return NextResponse.json({
      success: true,
      sourceId: source.sourceId,
      pairsIngested: pairs.length,
      charCount: source.charCount,
    });
  } catch (error) {
    console.error("[CHAT_HISTORY_UPLOAD]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
