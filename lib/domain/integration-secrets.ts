/**
 * The response shape of `POST /api/internal/integration-secrets`.
 *
 * Kept as a pure function so the one invariant the channel adapters depend on
 * can be tested without a database: the decrypted config must be returned
 * **flat**, under exactly the field names the adapters read.
 *
 * ## Why the `pageToken` → `pageAccessToken` alias exists
 *
 * Facebook's `Integration.config` stores the page token as `pageToken`, while
 * every Facebook workflow expression (and `Build Brain Payload`) reads
 * `pageAccessToken`. That translation used to happen in the `Fetch Integration`
 * SQL (`i.config->>'pageToken' AS "pageAccessToken"`). When the HTTP node
 * replaced that step, the alias had to move somewhere — and it was missed, so
 * the first live message after the migration was sent with an empty
 * `access_token` and Meta answered `Cannot parse access token`.
 *
 * The alias is generic rather than gated on `platform === "facebook"`: both
 * names denote the same value, so an integration carrying either one should
 * work.
 */

export interface IntegrationSecretBase {
  integrationId: string;
  chatbotId: string;
  connected: boolean;
  status: string;
}

/** Flat payload: base fields first, then the integration's decrypted config. */
export function shapeIntegrationSecrets(
  base: IntegrationSecretBase,
  config: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...base, ...config };

  if (typeof payload.pageAccessToken !== "string" && typeof payload.pageToken === "string") {
    payload.pageAccessToken = payload.pageToken;
  }

  return payload;
}
