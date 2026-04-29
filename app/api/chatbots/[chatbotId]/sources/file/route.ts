// Fixed pdf-parse import
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOwnedChatbot } from "@/lib/chatbot-access";
import { createSourceWithEmbeddings, normalizeSourceText } from "@/lib/source-ingestion";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";
import path from "path";

// Set the worker path for pdf-parse (pdfjs-dist) in Node.js environment
if (typeof window === "undefined") {
  const workerPath = path.resolve(process.cwd(), "node_modules/pdfjs-dist/build/pdf.worker.mjs");
  PDFParse.setWorker(workerPath);
}

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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let text = "";

    if (file.name.endsWith(".pdf")) {
      const pdf = new PDFParse({ data: buffer });
      const result = await pdf.getText();
      text = result.text;
    } else if (file.name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.name.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    text = normalizeSourceText(text, 50000);

    if (!text) {
      return NextResponse.json({ error: "No text found in file" }, { status: 400 });
    }

    const source = await createSourceWithEmbeddings({
      chatbotId,
      type: "file",
      name: file.name,
      content: text,
    });

    return NextResponse.json(source);
  } catch (error) {
    console.error("[SOURCE_FILE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
