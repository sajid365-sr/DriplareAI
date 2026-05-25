import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";

// Helper: Extract Google Sheet ID from a URL
function extractSheetId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// GET: Fetch current e-commerce config
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatbotId } = await params;

  // Verify chatbot belongs to user
  const chatbot = await db.chatbot.findFirst({
    where: { chatbotId, userId },
  });
  if (!chatbot) return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });

  const config = await db.ecommerceConfig.findUnique({
    where: { chatbotId },
  });

  return NextResponse.json({ config: config ?? null });
}

// POST: Create or update e-commerce config (upsert)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { chatbotId } = await params;

  // Verify chatbot belongs to user
  const chatbot = await db.chatbot.findFirst({
    where: { chatbotId, userId },
  });
  if (!chatbot) return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });

  const body = await req.json();
  const {
    productSheetUrl,
    orderSheetUrl,
    productSheetName,
    orderSheetName,
    steadfastEnabled,
    steadfastApiKey,
    steadfastSecretKey,
    pathaoEnabled,
    pathaoClientId,
    pathaoClientSecret,
    pathaoMerchantId,
  } = body;

  // Auto-extract sheet IDs from URLs
  const productSheetId = extractSheetId(productSheetUrl);
  const orderSheetId = extractSheetId(orderSheetUrl);

  const config = await db.ecommerceConfig.upsert({
    where: { chatbotId },
    create: {
      chatbotId,
      productSheetUrl,
      orderSheetUrl,
      productSheetId,
      orderSheetId,
      productSheetName: productSheetName || "Products",
      orderSheetName: orderSheetName || "Orders",
      steadfastEnabled: steadfastEnabled ?? false,
      steadfastApiKey: steadfastApiKey || null,
      steadfastSecretKey: steadfastSecretKey || null,
      pathaoEnabled: pathaoEnabled ?? false,
      pathaoClientId: pathaoClientId || null,
      pathaoClientSecret: pathaoClientSecret || null,
      pathaoMerchantId: pathaoMerchantId || null,
    },
    update: {
      productSheetUrl,
      orderSheetUrl,
      productSheetId,
      orderSheetId,
      productSheetName: productSheetName || "Products",
      orderSheetName: orderSheetName || "Orders",
      steadfastEnabled: steadfastEnabled ?? false,
      steadfastApiKey: steadfastApiKey || null,
      steadfastSecretKey: steadfastSecretKey || null,
      pathaoEnabled: pathaoEnabled ?? false,
      pathaoClientId: pathaoClientId || null,
      pathaoClientSecret: pathaoClientSecret || null,
      pathaoMerchantId: pathaoMerchantId || null,
    },
  });

  return NextResponse.json({ config });
}
