/**
 * Next.js instrumentation hook — runs once per server process, before the app
 * starts serving requests.
 *
 * Today it does one job: audit the n8n webhook URLs at boot. A `webhook-test`
 * path only accepts requests while "Listen for test event" is active in the n8n
 * editor, so in production the channel fails *silently* — Meta still gets its
 * 200 from us, n8n never runs, and customers simply stop getting replies. That
 * is far cheaper to catch at boot than from a support ticket.
 */

const N8N_WEBHOOK_ENV_VARS = [
  "N8N_WEBHOOK_URL",
  "N8N_WHATSAPP_WEBHOOK_URL",
  "N8N_INSTAGRAM_WEBHOOK_URL",
  "N8N_INGEST_WEBHOOK_URL",
  "N8N_WEB_WEBHOOK_URL",
] as const;

const TEST_WEBHOOK_SEGMENT = "/webhook-test/";

export async function register() {
  // The hook also runs on the edge runtime, where these server-only variables
  // are not readable. Auditing belongs to the Node.js process.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  auditN8nWebhookUrls();
}

function auditN8nWebhookUrls() {
  const isProduction = process.env.NODE_ENV === "production";
  const testPathVars: string[] = [];
  const missingVars: string[] = [];

  for (const name of N8N_WEBHOOK_ENV_VARS) {
    const value = process.env[name]?.trim();

    if (!value) {
      missingVars.push(name);
      continue;
    }

    if (value.includes(TEST_WEBHOOK_SEGMENT)) {
      testPathVars.push(name);
    }
  }

  // A test path in production is a live outage: escalate to error so it stands
  // out in log triage. In development it is a normal way to work, so it is only
  // a warning.
  if (testPathVars.length > 0) {
    const message =
      `[env-audit] ${testPathVars.join(", ")} point at an n8n TEST webhook ` +
      `("${TEST_WEBHOOK_SEGMENT}"). Test URLs only accept requests while the n8n ` +
      `editor is listening, so these channels fail silently. Use the production ` +
      `path ("/webhook/...") and make sure the workflow is Active.`;

    if (isProduction) {
      console.error(message);
    } else {
      console.warn(message);
    }
  }

  // Missing variables are only reported in production — a local .env may
  // deliberately leave a channel unconfigured, and some deployments disable
  // channels they do not sell yet.
  if (isProduction && missingVars.length > 0) {
    console.warn(
      `[env-audit] Not configured: ${missingVars.join(", ")}. ` +
        `Requests for those channels will not reach n8n.`
    );
  }

  // Positive confirmation in production, so "audit passed" is distinguishable
  // from "audit never ran" when reading logs.
  if (isProduction && testPathVars.length === 0 && missingVars.length === 0) {
    console.log("[env-audit] All n8n webhook URLs use production paths.");
  }
}
