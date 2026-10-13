/**
 * The website widget's address grammar.
 *
 * ## What the widget key is
 *
 * A merchant embeds one line on their site:
 *
 * ```html
 * <script src="https://app.driplare.com/widget/<widgetKey>.js" async></script>
 * ```
 *
 * That `<widgetKey>` is the integration's own `integrationId` — the cuid column
 * on `Integration` that already carries `@unique @default(cuid())`.
 *
 * It was chosen over a purpose-built "widget token" on purpose:
 *
 *   - **Nothing to migrate.** Every integration that exists today already has
 *     one, so the channel works the moment this ships rather than after a
 *     schema change and a backfill.
 *   - **It is already a secret-shaped value.** A cuid is opaque and not
 *     enumerable, so a script tag cannot be guessed from a `chatbotId`.
 *   - **It is the indexed lookup.** `findUnique({ where: { integrationId } })`
 *     is one index probe. A key kept inside the `config` JSON blob would have
 *     forced either a sequential scan of every integration on every page view
 *     or a JSONB index — i.e. DDL — to do the same job.
 *   - **Storing it elsewhere buys nothing.** `integrationId` is already sent to
 *     the merchant's own browser by `/api/integrations` and
 *     `toPublicIntegration()`, so it is not a value this feature newly exposes.
 *
 * ## What protects the merchant
 *
 * The key is public by nature — it sits in the HTML of a public page. So the
 * defence is not secrecy but *scope*:
 *
 *   - Everything that can **change** an integration (`PATCH`/`DELETE
 *     /api/integrations/[integrationId]`) is Clerk-gated **and** scoped by
 *     `chatbot: { userId }`. Holding the key grants no control over anything.
 *   - The key can only ever **read** one chatbot's configuration and spend that
 *     merchant's credits on a reply — which is the feature.
 *   - `connected: false` silences the widget everywhere at once. That is the
 *     revoke lever: disconnecting the Website channel in the dashboard turns
 *     every embed of it dark, and `resolveWidgetEmbed()` refuses to serve a
 *     script for a disconnected integration.
 *
 * ⚠️ What this design does **not** offer is **key rotation** — issuing a fresh
 *    key while the old one dies, leaving the merchant's real site working via an
 *    updated tag. `integrationId` is the row's identity; changing it would
 *    orphan `ChatSession.integrationId` and the merchant's own dashboard links.
 *    Rotation needs a dedicated nullable-unique column on `Integration`, which
 *    is DDL this task deliberately did not take on. Disconnect-to-revoke covers
 *    the abuse case today; rotation is the follow-up. This is written down here
 *    so the gap is not rediscovered as a surprise later.
 */

/** The suffix the embed URL ends in — cosmetic, but conventional for `<script>`. */
export const WIDGET_SCRIPT_SUFFIX = ".js";

/** Where the embeddable script is served from. */
export const WIDGET_SCRIPT_PREFIX = "/widget/";

/** Where the widget posts a visitor's message. */
export const WIDGET_API_PREFIX = "/api/widget/";

/**
 * A cuid is lowercase alphanumeric, 25 characters by default. The bounds are
 * loosened on either side so a change of id generator on `Integration` does not
 * silently 404 every embedded widget — the point of the check is to reject
 * path-traversal and query junk, not to pin a format we do not own.
 */
const WIDGET_KEY_PATTERN = /^[a-z0-9]{8,64}$/;

/**
 * The key inside a `/widget/<segment>` request, or `null` if it cannot be one.
 *
 * A trailing `.js` is optional so both spellings resolve to the same widget:
 * the embed tag uses it, but a merchant who trims it while pasting still gets a
 * working script rather than a blank page.
 */
export function parseWidgetKey(rawSegment: string): string | null {
  const withoutSuffix = rawSegment.endsWith(WIDGET_SCRIPT_SUFFIX)
    ? rawSegment.slice(0, -WIDGET_SCRIPT_SUFFIX.length)
    : rawSegment;
  const key = withoutSuffix.trim();

  return WIDGET_KEY_PATTERN.test(key) ? key : null;
}

/** `/widget/<key>.js` — the path half of the embed code. */
export function buildWidgetScriptPath(widgetKey: string): string {
  return `${WIDGET_SCRIPT_PREFIX}${widgetKey}${WIDGET_SCRIPT_SUFFIX}`;
}

/** `/api/widget/<key>` — where the widget script sends a visitor's message. */
export function buildWidgetApiPath(widgetKey: string): string {
  return `${WIDGET_API_PREFIX}${widgetKey}`;
}

/**
 * The line the merchant pastes into their site.
 *
 * `async` so a slow widget response can never hold up the page it is embedded
 * in — the merchant's own site performance is not ours to spend.
 *
 * ⚠️ The origin is passed in rather than read from an env var, because
 *    `NEXT_PUBLIC_APP_URL` names one host while the merchant may reach the
 *    dashboard on another (preview deploy, custom domain). The embed code has
 *    to point at the host the merchant is *actually looking at*, or the tag
 *    they copy would not match the page that just showed it to them.
 */
export function buildWidgetEmbedCode(origin: string, widgetKey: string): string {
  return `<script src="${origin.replace(/\/+$/, "")}${buildWidgetScriptPath(widgetKey)}" async></script>`;
}

/**
 * A `Host` header is attacker-controlled, and its value is written into the JS
 * we serve — so it is accepted only if it looks like a host and nothing else.
 *
 * Without this, a request carrying `Host: evil.com/x` would be baked into the
 * served script as the API base, and a widget on a real merchant's page would
 * post visitor messages to a third party. The pattern admits DNS names, IPv4
 * and bracketed IPv6 with an optional port; anything else is refused and the
 * caller falls back to a configured origin.
 */
const SAFE_HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;
const SAFE_IPV6_HOST_PATTERN = /^\[[0-9a-f:]+\](:\d{1,5})?$/i;

export function isSafeHost(host: string): boolean {
  return SAFE_HOST_PATTERN.test(host) || SAFE_IPV6_HOST_PATTERN.test(host);
}

/**
 * The public origin this request arrived on.
 *
 * `x-forwarded-*` first: behind Vercel (and behind Coolify later) the app sees
 * the proxy's own `host`, while the browser saw the merchant's domain. Taking
 * `host` would hand back an internal address that resolves to nothing on the
 * visitor's machine.
 *
 * Returns `null` when no trustworthy host is present, so the caller can decide
 * on a fallback rather than receive a half-built URL.
 */
export function resolveRequestOrigin(headers: Headers): string | null {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "")
    .split(",")[0]
    .trim();

  if (!host || !isSafeHost(host)) return null;

  const forwardedProto = (headers.get("x-forwarded-proto") ?? "").split(",")[0].trim();
  // Local development is the one place where the default is not HTTPS.
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const proto = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : isLocal
      ? "http"
      : "https";

  return `${proto}://${host}`;
}

/**
 * The one colour the widget is allowed to be built around, as a hex literal.
 *
 * `Chatbot.avatarColor` is a free-text column an admin can edit, and its value
 * is written into a `<style>` block inside the shadow root. A value that is not
 * a hex colour would therefore not merely look wrong — it would be markup
 * injected into a page we do not own. So it is validated, not escaped.
 *
 * The fallback is the same violet the app's `--primary` is built from
 * (`Chatbot.avatarColor`'s own default), so a widget with no colour of its own
 * still matches the dashboard it was configured in.
 */
export const DEFAULT_WIDGET_BRAND = "#6d28d9";
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function sanitizeBrandColor(value: unknown): string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim())
    ? value.trim()
    : DEFAULT_WIDGET_BRAND;
}
