import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { exchangeFacebookBusinessLoginCode } from "./facebook";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Facebook Login for Business", () => {
  it("exchanges the Facebook Login for Business popup code without redirect_uri", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_APP_ID", "driplare-meta-app");
    vi.stubEnv("META_APP_SECRET", "driplare-meta-secret");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return Response.json({
        access_token: "business-login-user-token",
        expires_in: 3600,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeFacebookBusinessLoginCode("one-time-code")).resolves.toMatchObject({
      access_token: "business-login-user-token",
      expires_in: 3600,
    });

    const [url] = fetchMock.mock.calls[0];
    const parsedUrl = new URL(String(url));
    expect(parsedUrl.origin).toBe("https://graph.facebook.com");
    expect(parsedUrl.pathname).toBe("/v20.0/oauth/access_token");
    expect(parsedUrl.searchParams.get("client_id")).toBe("driplare-meta-app");
    expect(parsedUrl.searchParams.get("client_secret")).toBe("driplare-meta-secret");
    expect(parsedUrl.searchParams.get("code")).toBe("one-time-code");
    expect(parsedUrl.searchParams.has("redirect_uri")).toBe(false);
  });
});
