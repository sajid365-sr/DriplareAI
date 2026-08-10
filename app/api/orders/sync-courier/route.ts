import { NextResponse } from "next/server";
import { POST as syncStatusHandler } from "../sync-status/route";

export async function POST() {
  return syncStatusHandler();
}
