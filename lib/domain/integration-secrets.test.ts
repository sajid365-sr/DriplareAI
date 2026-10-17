import { describe, expect, it } from "vitest";

import { shapeIntegrationSecrets, type IntegrationSecretBase } from "./integration-secrets";

const BASE: IntegrationSecretBase = {
  integrationId: "int_1",
  chatbotId: "bot_1",
  connected: true,
  status: "active",
};

describe("shapeIntegrationSecrets", () => {
  it("returns the config flat, keeping every key the adapters read", () => {
    const payload = shapeIntegrationSecrets(BASE, {
      pageId: "7107567321108118",
      pageToken: "EAA-live",
      commentReply: { enabled: false },
    });

    expect(payload.integrationId).toBe("int_1");
    expect(payload.chatbotId).toBe("bot_1");
    expect(payload.connected).toBe(true);
    expect(payload.pageId).toBe("7107567321108118");
  });

  it("exposes a Facebook `pageToken` as `pageAccessToken`", () => {
    // The live failure this guard exists for: without the alias the workflow
    // builds `.../messages?access_token=` and Meta replies
    // `Cannot parse access token`.
    const payload = shapeIntegrationSecrets(BASE, { pageToken: "EAA-live" });

    expect(payload.pageAccessToken).toBe("EAA-live");
  });

  it("does not let the alias overwrite a real `pageAccessToken`", () => {
    // Instagram's config already carries `pageAccessToken`; a stray `pageToken`
    // must not replace it.
    const payload = shapeIntegrationSecrets(BASE, {
      pageAccessToken: "IGAA-correct",
      pageToken: "EAA-stale",
    });

    expect(payload.pageAccessToken).toBe("IGAA-correct");
  });

  it("passes a config without any page token through untouched", () => {
    const payload = shapeIntegrationSecrets(BASE, { accessToken: "EAA-whatsapp" });

    expect(payload).not.toHaveProperty("pageAccessToken");
    expect(payload.accessToken).toBe("EAA-whatsapp");
  });
});
