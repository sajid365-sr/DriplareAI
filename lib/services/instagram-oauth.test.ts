import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getInstagramLoginRedirectUri,
  signInstagramOAuthState,
  verifyInstagramOAuthState,
} from "./instagram-oauth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Instagram OAuth state", () => {
  it("preserves the exact redirect URI used to start authorization", () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "test-instagram-app-secret");
    const redirectUri = "https://driplare-ai.vercel.app/api/integrations/instagram/oauth/callback";
    const state = signInstagramOAuthState({
      chatbotId: "chatbot-1",
      userId: "user-1",
      redirectUri,
    });

    vi.stubEnv("INSTAGRAM_LOGIN_REDIRECT_URI", "https://other-host.example/callback");
    const parsedState = verifyInstagramOAuthState(state);

    expect(parsedState?.redirectUri).toBe(redirectUri);
    expect(getInstagramLoginRedirectUri(new Request("https://other-host.example/callback")))
      .not.toBe(parsedState?.redirectUri);
  });
});
