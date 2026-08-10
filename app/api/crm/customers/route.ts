import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

type SessionMetadata = {
  phone?: unknown;
  customerPhone?: unknown;
  mobile?: unknown;
  address?: unknown;
  deliveryAddress?: unknown;
  district?: unknown;
  tags?: unknown;
  aiTags?: unknown;
  leadTags?: unknown;
  intent?: unknown;
  intents?: unknown;
  topic?: unknown;
  orderStatus?: unknown;
  aiSummary?: unknown;
  summary?: unknown;
  insights?: unknown;
  buyingIntentScore?: unknown;
  internalNotes?: unknown;
  staffNotes?: unknown;
};

type StaffNote = {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
};

type CustomerOrder = {
  orderId: string;
  items: Prisma.JsonValue;
  totalAmount: number;
  status: string;
  createdAt: string;
};

type CustomerLead = {
  id: string;
  guestName: string;
  profilePhoto: string | null;
  platform: string;
  phone: string | null;
  address: string | null;
  aiTags: string[];
  aiSummary: string[];
  buyingIntentScore: number;
  staffNotes: StaffNote[];
  orderHistory: CustomerOrder[];
  totalOrders: number;
  totalSpent: number;
  firstContact: string;
  lastActive: string;
  updatedAt: string;
};

const CONFIRMED_ORDER_STATUSES = new Set([
  "confirmed",
  "completed",
  "delivered",
  "dispatched",
  "processing",
  "shipped",
]);

const CANCELLED_ORDER_STATUSES = new Set([
  "cancelled",
  "canceled",
  "failed",
  "returned",
  "refunded",
]);

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePhone(value: string | null) {
  return value ? value.replace(/\D/g, "") : "";
}

function getMetadata(value: Prisma.JsonValue | null): SessionMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SessionMetadata)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : null))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function asStaffNotes(value: unknown): StaffNote[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const note = item as Partial<StaffNote>;
      const text = asString(note.text);
      if (!text) return null;

      return {
        id: asString(note.id) || `note_${Date.now()}`,
        text,
        authorName: asString(note.authorName) || "Staff",
        createdAt: asString(note.createdAt) || new Date().toISOString(),
      };
    })
    .filter((item): item is StaffNote => Boolean(item));
}

function getBuyingIntentScore(metadata: SessionMetadata, tags: string[], totalOrders: number) {
  const explicitScore =
    typeof metadata.buyingIntentScore === "number"
      ? metadata.buyingIntentScore
      : typeof metadata.buyingIntentScore === "string"
        ? Number.parseInt(metadata.buyingIntentScore, 10)
        : null;

  if (explicitScore && Number.isFinite(explicitScore)) {
    return Math.max(0, Math.min(100, explicitScore));
  }

  const normalizedTags = tags.map((item) => item.toLowerCase());
  if (totalOrders > 0 || normalizedTags.includes("successful") || normalizedTags.includes("top_client")) return 92;
  if (normalizedTags.includes("high_prospect")) return 85;
  if (normalizedTags.includes("priority")) return 74;
  if (normalizedTags.includes("risky")) return 38;
  return 55;
}

function uniqueTags(...groups: Array<string[] | string | null | undefined>) {
  const tags = groups.flatMap((group) => {
    if (!group) return [];
    return Array.isArray(group) ? group : [group];
  });

  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function isConfirmedOrder(status: string | null) {
  return CONFIRMED_ORDER_STATUSES.has((status || "").toLowerCase());
}

function isNonCancelledOrder(status: string | null) {
  return !CANCELLED_ORDER_STATUSES.has((status || "").toLowerCase());
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const chatbotId = url.searchParams.get("chatbotId")?.trim();
    const search = url.searchParams.get("search")?.trim().toLowerCase() || "";
    const platform = url.searchParams.get("platform")?.trim().toLowerCase() || "";
    const tag = url.searchParams.get("tag")?.trim().toLowerCase() || "";
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(url.searchParams.get("limit"), 10), 100);

    if (!chatbotId) {
      return NextResponse.json({ error: "chatbotId is required" }, { status: 400 });
    }

    const workspace = await getActiveWorkspace(userId);
    const chatbot = await db.chatbot.findFirst({
      where: {
        userId,
        workspaceId: workspace.workspaceId,
        OR: [{ id: chatbotId }, { chatbotId }],
      },
      select: { chatbotId: true },
    });

    if (!chatbot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const sessions = await db.chatSession.findMany({
      where: {
        chatbotId: chatbot.chatbotId,
        ...(platform ? { platform } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    const sessionIds = sessions.map((session) => session.sessionId);
    const sessionPhones = sessions
      .map((session) => {
        const metadata = getMetadata(session.aiExtractionData);
        return (
          asString(metadata.phone) ||
          asString(metadata.customerPhone) ||
          asString(metadata.mobile)
        );
      })
      .filter((phone): phone is string => Boolean(phone));

    const orders = await db.order.findMany({
      where: {
        chatbotId: chatbot.chatbotId,
        OR: [
          { sessionId: { in: sessionIds.length ? sessionIds : ["__none__"] } },
          { customerPhone: { in: sessionPhones.length ? sessionPhones : ["__none__"] } },
        ],
      },
      select: {
        sessionId: true,
        customerPhone: true,
        orderId: true,
        items: true,
        totalAmount: true,
        status: true,
        createdAt: true,
      },
    });

    const leads = sessions.map<CustomerLead>((session) => {
      const metadata = getMetadata(session.aiExtractionData);
      const phone =
        asString(metadata.phone) ||
        asString(metadata.customerPhone) ||
        asString(metadata.mobile);
      const address =
        asString(metadata.address) ||
        asString(metadata.deliveryAddress) ||
        asString(metadata.district);
      const normalizedSessionPhone = normalizePhone(phone);
      const matchedOrders = orders.filter((order) => {
        const normalizedOrderPhone = normalizePhone(order.customerPhone);
        return (
          order.sessionId === session.sessionId ||
          (!!normalizedSessionPhone && normalizedOrderPhone === normalizedSessionPhone)
        );
      });
      const aiTags = uniqueTags(
        session.leadStatus && session.leadStatus !== "none" ? session.leadStatus : null,
        session.topic,
        asStringArray(metadata.tags),
        asStringArray(metadata.aiTags),
        asStringArray(metadata.leadTags),
        asString(metadata.intent),
        asString(metadata.intents),
        asString(metadata.topic),
        asString(metadata.orderStatus)
      );
      const aiSummary = asStringArray(metadata.aiSummary).length
        ? asStringArray(metadata.aiSummary)
        : asStringArray(metadata.summary).length
          ? asStringArray(metadata.summary)
          : asStringArray(metadata.insights).length
            ? asStringArray(metadata.insights)
            : uniqueTags(session.topic, asString(metadata.intent), asString(metadata.orderStatus)).slice(0, 3);
      const orderHistory = matchedOrders
        .slice()
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((order) => ({
          orderId: order.orderId,
          items: order.items,
          totalAmount: order.totalAmount || 0,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
        }));
      const totalOrders = matchedOrders.filter((order) => isConfirmedOrder(order.status)).length;

      return {
        id: session.sessionId,
        guestName: session.guestName || "Unknown Customer",
        profilePhoto: session.profilePhoto,
        platform: session.platform,
        phone,
        address,
        aiTags,
        aiSummary,
        buyingIntentScore: getBuyingIntentScore(metadata, aiTags, totalOrders),
        staffNotes: asStaffNotes(metadata.internalNotes).length
          ? asStaffNotes(metadata.internalNotes)
          : asStaffNotes(metadata.staffNotes),
        orderHistory,
        totalOrders,
        totalSpent: matchedOrders
          .filter((order) => isNonCancelledOrder(order.status))
          .reduce((sum, order) => sum + (order.totalAmount || 0), 0),
        firstContact: session.createdAt.toISOString(),
        lastActive: session.updatedAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    });

    const filteredLeads = leads.filter((lead) => {
      const matchesSearch = search
        ? lead.guestName.toLowerCase().includes(search) ||
          lead.id.toLowerCase().includes(search) ||
          (lead.phone || "").toLowerCase().includes(search) ||
          normalizePhone(lead.phone).includes(normalizePhone(search))
        : true;
      const matchesTag = tag
        ? lead.aiTags.some((aiTag) => aiTag.toLowerCase() === tag || aiTag.toLowerCase().includes(tag))
        : true;

      return matchesSearch && matchesTag;
    });

    const total = filteredLeads.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const customers = filteredLeads.slice(start, start + limit);

    const stats = {
      totalContacts: total,
      highProspects: filteredLeads.filter((lead) =>
        lead.aiTags.some((aiTag) => ["high_prospect", "priority"].includes(aiTag.toLowerCase()))
      ).length,
      payingCustomers: filteredLeads.filter((lead) => lead.totalOrders > 0 || lead.totalSpent > 0).length,
      totalRevenue: filteredLeads.reduce((sum, lead) => sum + lead.totalSpent, 0),
    };

    return NextResponse.json({
      stats,
      customers,
      pagination: {
        total,
        page,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[CRM_CUSTOMERS_GET]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
