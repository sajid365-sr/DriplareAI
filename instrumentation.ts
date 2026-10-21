/**
 * Next.js instrumentation hook — runs once per server process, before the app
 * starts serving requests.
 *
 * It audits two things at boot, both chosen because they fail *silently* in
 * production and only surface as a support ticket:
 *
 *   1. n8n webhook URLs pointing at a `webhook-test` path — those only accept
 *      requests while "Listen for test event" is active in the n8n editor.
 *   2. `INTEGRATION_ENCRYPTION_KEY` — without it, integration tokens can be
 *      neither encrypted on write nor decrypted on read, so every channel that
 *      hands over a credential breaks at the moment a merchant connects it.
 */

// Imported from the edge-safe module on purpose. `lib/core/crypto.ts` would
// drag Node's `crypto` builtin into the Edge compile of this file, and the hook
// is bundled for both runtimes.
import {
  describeEncryptionKeyProblem,
  ENCRYPTION_KEY_ENV,
  encryptionKeyFingerprint,
} from "@/lib/core/key-fingerprint";

const N8N_WEBHOOK_ENV_VARS = [  "N8N_WEBHOOK_URL",
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
  await auditIntegrationEncryptionKey();
}

/**
 * Report the state of the credential encryption key.
 *
 * The fingerprint is logged only in production and only when the key is valid:
 * it is a truncated SHA-256 of the key, so it is safe to log, and it is the
 * fastest way to answer "is n8n using the same key as the app?" when a channel
 * starts returning decryption errors. The key itself is never logged.
 */
async function auditIntegrationEncryptionKey() {
  const isProduction = process.env.NODE_ENV === "production";
  const key = process.env[ENCRYPTION_KEY_ENV];
  const problem = describeEncryptionKeyProblem(key);

  if (problem) {
    const message =
      `[env-audit] ${ENCRYPTION_KEY_ENV} is unusable — ${problem} ` +
      `Integration tokens cannot be encrypted or decrypted, so connecting any ` +
      `channel (Facebook, WhatsApp, Instagram) will fail.`;

    // A missing key is a normal state while an environment is being set up
    // locally, but in production it is a live outage.
    if (isProduction) {
      console.error(message);
    } else {
      console.warn(message);
    }

    return;
  }

  if (isProduction) {
    console.log(
      `[env-audit] ${ENCRYPTION_KEY_ENV} loaded (fingerprint ${await encryptionKeyFingerprint(key)}). ` +
        `The n8n decrypt step must use a key with the same fingerprint.`
    );
  }
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
