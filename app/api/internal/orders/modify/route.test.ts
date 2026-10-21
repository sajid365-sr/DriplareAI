import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

// Mock dependencies
vi.mock("@/lib/core/db", () => {
  const mockOrder = {
    id: "ord_1",
    orderId: "ORD-TEST01",
    chatbotId: "bot_123",
    sessionId: "sess_456",
    customerName: "Sakib Al Hasan",
    customerPhone: "01700000000",
    deliveryAddress: "Mirpur 1",
    district: "Dhaka",
    items: [{ name: "Cricket Bat", qty: 1, price: 2500 }],
    totalAmount: 2500,
    status: "Processing",
    modificationHistory: [],
    chatbot: { userId: "user_789", chatbotId: "bot_123" },
  };

  return {
    db: {
      order: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      chatMessage: {
        create: vi.fn().mockResolvedValue({ id: "msg_1" }),
      },
    },
  };
});

vi.mock("@/lib/services/inbox-delivery", () => ({
  deliverInboxMessage: vi.fn().mockResolvedValue({ delivered: true }),
}));

describe("POST /api/internal/orders/modify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.N8N_CALLBACK_SECRET = "test-secret-123";
  });

  it("returns 401 when x-n8n-secret is missing or incorrect", async () => {
    const req = new Request("http://localhost/api/internal/orders/modify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId: "bot_123", sessionId: "sess_456" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects modification if order is already confirmed or dispatched", async () => {
    const { db } = await import("@/lib/core/db");
    (db.order.findFirst as any).mockResolvedValue({
      id: "ord_1",
      orderId: "ORD-TEST01",
      status: "Shipped",
      chatbot: { userId: "user_789", chatbotId: "bot_123" },
    });

    const req = new Request("http://localhost/api/internal/orders/modify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-n8n-secret": "test-secret-123",
      },
      body: JSON.stringify({
        chatbotId: "bot_123",
        sessionId: "sess_456",
        deliveryAddress: "Dhanmondi 27",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.reason).toBe("order_already_confirmed");
  });

  it("successfully modifies pre-confirm order and dispatches updated bill", async () => {
    const { db } = await import("@/lib/core/db");
    (db.order.findFirst as any).mockResolvedValue({
      id: "ord_1",
      orderId: "ORD-TEST01",
      chatbotId: "bot_123",
      sessionId: "sess_456",
      customerName: "Sakib Al Hasan",
      customerPhone: "01700000000",
      deliveryAddress: "Mirpur 1",
      district: "Dhaka",
      items: [{ name: "Cricket Bat", qty: 1, price: 2500 }],
      totalAmount: 2500,
      status: "Processing",
      modificationHistory: [],
      chatbot: { userId: "user_789", chatbotId: "bot_123" },
    });

    (db.order.update as any).mockResolvedValue({
      id: "ord_1",
      orderId: "ORD-TEST01",
      customerName: "Sakib Al Hasan",
      customerPhone: "01711111111",
      deliveryAddress: "Uttara Sector 3",
      district: "Dhaka",
      items: [{ name: "Cricket Bat", qty: 2, price: 2500 }],
      totalAmount: 5000,
      status: "Processing",
      modificationHistory: [
        {
          modifiedAt: new Date().toISOString(),
          modifiedBy: "ai_agent",
        },
      ],
    });

    const req = new Request("http://localhost/api/internal/orders/modify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-n8n-secret": "test-secret-123",
      },
      body: JSON.stringify({
        chatbotId: "bot_123",
        sessionId: "sess_456",
        customerPhone: "01711111111",
        deliveryAddress: "Uttara Sector 3",
        items: [{ name: "Cricket Bat", qty: 2, price: 2500 }],
        reason: "Customer asked to increase quantity to 2 and change address",
        sendNewBill: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.orderId).toBe("ORD-TEST01");
    expect(data.totalAmount).toBe(5000);
    expect(data.deliveryAddress).toBe("Uttara Sector 3");
    expect(data.billSent).toBe(true);
  });
});
