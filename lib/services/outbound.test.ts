import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { deliverOutbound } from "./outbound";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Instagram Login outbound delivery", () => {
  it("sends replies with the Instagram account token and endpoint", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ message_id: "instagram-message-1" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const now = new Date();

    await expect(deliverOutbound({
      platform: "instagram",
      sessionId: "ig_customer-1",
      config: {
        connectionSource: "instagram_login",
        instagramAccountId: "ig-business-1",
        instagramAccessToken: "instagram-token",
      },
      lastInboundAt: new Date(now.getTime() - 60 * 60 * 1000),
    }, { text: "Hello from the AI Agent" }, now)).resolves.toEqual({
      delivered: true,
      platformMessageId: "instagram-message-1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://graph.instagram.com/v27.0/ig-business-1/messages");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer instagram-token");
    expect(JSON.parse(String(init?.body))).toEqual({
      recipient: { id: "customer-1" },
      message: { text: "Hello from the AI Agent" },
    });
  });

  it("does not send if the Instagram Login token is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(deliverOutbound({
      platform: "instagram",
      sessionId: "ig_customer-1",
      config: {
        connectionSource: "instagram_login",
        instagramAccountId: "ig-business-1",
      },
    }, { text: "Hello" })).resolves.toEqual({
      delivered: false,
      skipReason: "missing_credentials",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
