import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";

export async function GET() {
  try {
    const integrations = await db.integration.findMany({
      take: 10,
    });
    const sessions = await db.chatSession.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ integrations, sessions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
