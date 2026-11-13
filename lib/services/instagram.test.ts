import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildInstagramLoginAuthorizeUrl,
  subscribeInstagramLoginAccountToApp,
} from "./instagram";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Instagram Login", () => {
  it("requests only Instagram Login messaging permissions", () => {
    const url = new URL(buildInstagramLoginAuthorizeUrl({
      appId: "meta-app-id",
      redirectUri: "https://app.example.com/callback",
      state: "signed-state",
    }));

    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_manage_messages"
    );
    expect(url.searchParams.get("scope")).not.toContain("pages_");
    expect(url.searchParams.get("enable_fb_login")).toBe("false");
  });

  it("uses the Instagram App ID and secret for the authorization-code exchange", async () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "instagram-app-id");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "instagram-app-secret");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({
        access_token: "short-lived-token",
        user_id: "instagram-user-1",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { exchangeInstagramLoginCode } = await import("./instagram");
    await expect(exchangeInstagramLoginCode("auth-code", "https://app.example.com/callback"))
      .resolves.toEqual({ shortLivedToken: "short-lived-token", userId: "instagram-user-1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.instagram.com/oauth/access_token");
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toMatchObject({
      client_id: "instagram-app-id",
      client_secret: "instagram-app-secret",
      grant_type: "authorization_code",
    });
  });

  it("does not use Facebook App credentials as Instagram Login credentials", async () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "");
    vi.stubEnv("NEXT_PUBLIC_INSTAGRAM_APP_ID", "");
    vi.stubEnv("NEXT_PUBLIC_META_APP_ID", "driplare-meta-app");
    vi.stubEnv("NEXT_PUBLIC_FACEBOOK_APP_ID", "driplare-facebook-app");
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    vi.stubEnv("META_APP_SECRET", "driplare-meta-secret");
    vi.stubEnv("FACEBOOK_APP_SECRET", "driplare-facebook-secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { exchangeInstagramLoginCode } = await import("./instagram");
    await expect(
      exchangeInstagramLoginCode("auth-code", "https://app.example.com/callback")
    ).rejects.toThrow("Driplare's Instagram Login App ID is not configured");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("subscribes a standalone professional account to Instagram webhooks", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return Response.json({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(subscribeInstagramLoginAccountToApp("ig-account-1", "instagram-token"))
      .resolves.toEqual({ success: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://graph.instagram.com/v27.0/ig-account-1/subscribed_apps");
    expect(init?.method).toBe("POST");
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      subscribed_fields: "messages,messaging_postbacks",
      access_token: "instagram-token",
    });
  });

  it("surfaces webhook subscription failures instead of saving a broken channel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(
      { error: { message: "Permission denied", code: 10 } },
      { status: 400 }
    )));

    await expect(subscribeInstagramLoginAccountToApp("ig-account-1", "instagram-token"))
      .rejects.toMatchObject({
        message: "Permission denied",
        code: 10,
        status: 400,
      });
  });
});
