import type { Prisma } from "@prisma/client";

/**
 * The `Integration.config` keys a browser is allowed to see.
 *
 * `config` holds two very different kinds of value:
 *
 *   - **display and identity fields** — `pageId`, `pageName`, `phoneNumberId`,
 *     `wabaId`, `embedCode`, … — which the dashboard renders;
 *   - **credentials** — `pageToken`, `accessToken`, `instagramAccessToken`,
 *     `userAccessTokenLongLived` — which the browser never needs.
 *
 * The credential fields are also the long-lived ones: a Facebook Page token can
 * be replayed against the Graph API until it expires or is revoked. Returning
 * one in a JSON response puts it in browser memory, in the devtools network tab,
 * in any client-side error reporter, and in whatever proxy sits in front of the
 * app — so responses are built from this allow-list rather than by deleting keys
 * from the whole object.
 *
 * An allow-list is the deliberate choice: a new credential field added to an
 * integration is invisible to the client by default, whereas a deny-list would
 * leak it until someone remembered to add the name here.
 */
export const SAFE_CONFIG_KEYS = [
  "pageId",
  "pageName",
  "pageCategory",
  "pagePictureUrl",
  "instagramAccountId",
  "instagramUsername",
  "instagramName",
  "instagramProfilePictureUrl",
  "connectionSource",
  "wabaId",
  "phoneNumberId",
  "displayPhoneNumber",
  "verifiedName",
  "businessName",
  "qualityRating",
  "webhookSubscribedAt",
  "connectedAt",
  "tokenExpiresAt",
  "commentReply",
  "embedCode",
  "widgetPosition",
  // Read and written back by the channel settings modal (ConfigureChannelModal).
  // Omitting these does not just hide them — the modal would fall back to its
  // defaults and the next save would persist those defaults over the merchant's
  // real choices.
  "muteAiOnHandover",
  "directMessagingAiEnabled",
  "tokenStatus",
] as const;

/** Reduce a stored config to the keys that are safe to send to a client. */
export function buildPublicIntegrationConfig(
  config: Prisma.JsonValue | null | undefined
): Record<string, Prisma.JsonValue> {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {};
  }

  const source = config as Record<string, Prisma.JsonValue>;

  return SAFE_CONFIG_KEYS.reduce<Record<string, Prisma.JsonValue>>((safeConfig, key) => {
    if (source[key] !== undefined) {
      safeConfig[key] = source[key];
    }

    return safeConfig;
  }, {});
}

/**
 * Strip credentials from an integration row before it is serialised.
 *
 * Use this on every response that echoes an integration back to the browser —
 * connect, disconnect and status routes included. Those responses originate from
 * a Prisma `upsert`/`update`, so without this the row that comes back carries the
 * token that was just written.
 */
export function toPublicIntegration<T extends { config?: Prisma.JsonValue | null }>(
  integration: T
): Omit<T, "config"> & { config: Record<string, Prisma.JsonValue> } {
  const { config, ...rest } = integration;

  return { ...rest, config: buildPublicIntegrationConfig(config) };
}
