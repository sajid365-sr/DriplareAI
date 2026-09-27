import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// Clean and format Bangladeshi 11-digit mobile number
function formatBDPhoneNumber(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) {
    digits = digits.substring(2);
  }
  if (digits.startsWith("1") && digits.length === 10) {
    digits = "0" + digits;
  }
  return digits;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderIds, courierProvider = "Steadfast" } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "No order IDs provided for dispatch" },
        { status: 400 }
      );
    }

    const isTestMode = courierProvider.includes("Test") || courierProvider.includes("Sandbox");

    // Get active workspace to scope order authorization
    const workspace = await getActiveWorkspace(userId);
    const userBots = await db.chatbot.findMany({
      where: { userId, workspaceId: workspace.workspaceId },
      select: { id: true, chatbotId: true },
    });

    const botIds = Array.from(
      new Set(userBots.flatMap((b) => [b.id, b.chatbotId]))
    );

    // Fetch merchant's courier settings
    const courierConfig = await db.courierConfig.findUnique({
      where: { userId },
    });

    // Validate Steadfast credentials ONLY if Live mode is chosen
    if (courierProvider === "Steadfast" && !isTestMode) {
      if (!courierConfig?.steadfastApiKey || !courierConfig?.steadfastSecretKey) {
        return NextResponse.json(
          {
            error:
              "Steadfast API Key and Secret Key are missing. Please configure your credentials in Settings -> Courier API.",
          },
          { status: 400 }
        );
      }
    }

    // Verify orders belong to user's business
    const ordersToDispatch = await db.order.findMany({
      where: {
        id: { in: orderIds },
        chatbotId: { in: botIds },
      },
    });

    if (ordersToDispatch.length === 0) {
      return NextResponse.json(
        { error: "No valid orders found to dispatch" },
        { status: 404 }
      );
    }

    const updatedResults = [];
    const errorsList: Array<{ orderId: string; error: string }> = [];

    for (const order of ordersToDispatch) {
      let trackingCode = "";

      if (courierProvider === "Steadfast" && !isTestMode && courierConfig?.steadfastApiKey && courierConfig?.steadfastSecretKey) {
        try {
          // Steadfast requires a recipient phone — skip (don't mark Dispatched) if missing.
          if (!order.customerPhone) {
            errorsList.push({ orderId: order.orderId, error: "Customer phone number is missing" });
            continue;
          }

          const recipientPhone = formatBDPhoneNumber(order.customerPhone);
          const fullAddress = [order.deliveryAddress, order.district]
            .filter(Boolean)
            .join(", ");

          const payload = {
            invoice: order.orderId,
            recipient_name: order.customerName,
            recipient_phone: recipientPhone,
            recipient_address: fullAddress || "Dhaka",
            cod_amount: Number(order.totalAmount),
            note: order.internalNotes || "Order created via Driplare AI",
          };

          const sfResponse = await fetch("https://portal.packzy.com/api/v1/create_order", {
            method: "POST",
            headers: {
              "Api-Key": courierConfig.steadfastApiKey,
              "Secret-Key": courierConfig.steadfastSecretKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const rawText = await sfResponse.text();
          let sfData: any = null;
          try {
            sfData = JSON.parse(rawText);
          } catch {
            // Raw text response (e.g. "Account is not active!")
          }

          if (sfResponse.ok && sfData && sfData.status === 200 && sfData.consignment) {
            trackingCode = sfData.consignment.tracking_code || String(sfData.consignment.consignment_id);
          } else {
            const errorMsg =
              sfData?.message ||
              (sfData?.errors ? JSON.stringify(sfData.errors) : null) ||
              rawText ||
              "Steadfast API error";
            console.error(`Steadfast API Error for order ${order.orderId}:`, rawText);
            errorsList.push({ orderId: order.orderId, error: errorMsg });
            continue; // Skip DB status update for failed API dispatch
          }
        } catch (err: any) {
          console.error(`Steadfast dispatch exception for order ${order.orderId}:`, err);
          errorsList.push({ orderId: order.orderId, error: err.message || "Network error" });
          continue;
        }
      } else {
        // Test / Sandbox Mode or fallback
        const prefix = "STEAD-TEST";
        trackingCode = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
      }

      const displayProvider = isTestMode ? "Steadfast (Test)" : courierProvider;

      await db.order.update({
        where: { id: order.id },
        data: {
          status: "Dispatched",
          courierName: displayProvider,
          courierTrackingId: trackingCode,
          updatedAt: new Date(),
        },
      });

      // Update associated session lead data if applicable
      if (order.sessionId) {
        try {
          const session = await db.chatSession.findFirst({
            where: { chatbotId: order.chatbotId, sessionId: order.sessionId },
          });
          if (session) {
            const currentData = (session.aiExtractionData as Record<string, any>) || {};
            await db.chatSession.update({
              where: { id: session.id },
              data: {
                aiExtractionData: {
                  ...currentData,
                  courierTrackingId: trackingCode,
                  orderStatus: "dispatched",
                },
              },
            });
          }
        } catch (sessionErr) {
          console.error("Session update error:", sessionErr);
        }
      }

      updatedResults.push({ id: order.id, orderId: order.orderId, trackingCode });
    }

    if (updatedResults.length === 0 && errorsList.length > 0) {
      return NextResponse.json(
        {
          error: `Steadfast API Error: ${errorsList[0].error}`,
          details: errorsList,
        },
        { status: 400 }
      );
    }

    const providerName = isTestMode ? "Steadfast Sandbox 🧪" : courierProvider;

    return NextResponse.json({
      success: true,
      message: `Successfully dispatched ${updatedResults.length} order(s) via ${providerName}`,
      dispatchedCount: updatedResults.length,
      orders: updatedResults,
      errors: errorsList,
    });
  } catch (error: any) {
    console.error("[BULK_DISPATCH_POST]", error);
    return NextResponse.json(
      { error: error.message || "Failed to dispatch orders" },
      { status: 500 }
    );
  }
}
