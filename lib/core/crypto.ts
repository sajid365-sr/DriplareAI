/**
 * Field-level encryption for third-party credentials held at rest.
 *
 * `Integration.config` stores live credentials — Facebook Page tokens, WhatsApp
 * Cloud API tokens, Instagram long-lived tokens. Before this module existed they
 * sat in Postgres as plaintext, so a leaked `DATABASE_URL`, an over-broad
 * database role, or a Neon compromise handed an attacker the ability to send
 * messages as every merchant on the platform.
 *
 * Design notes
 * ------------
 * - **AES-256-GCM** (authenticated). A tampered or truncated ciphertext fails to
 *   decrypt loudly instead of producing a garbage token that only fails much
 *   later inside a Meta API call, far from the real cause.
 * - Stored format is `v1:<iv>:<authTag>:<ciphertext>`, each part base64. The
 *   version prefix is what makes a future key rotation possible, and it is how
 *   `isEncryptedSecret()` distinguishes a ciphertext from a value written before
 *   encryption existed.
 * - **Dual-read is what makes the rollout zero-downtime.** Anything that does
 *   not start with `v1:` is returned unchanged, so rows migrated later keep
 *   working, and a new deployment can go out before the backfill runs.
 * - **Identity keys stay plaintext.** `pageId`, `phoneNumberId`,
 *   `instagramAccountId`, `wabaId` and `connectionSource` are looked up by the
 *   n8n workflows with SQL such as `WHERE i.config->>'pageId' = '...'`. Only
 *   true secrets are encrypted — see `SECRET_CONFIG_KEYS`.
 */

import crypto from "crypto";

import {
  decodeEncryptionKey,
  describeEncryptionKeyProblem,
  ENCRYPTION_KEY_ENV,
  encryptionKeyFingerprint,
  isValidEncryptionKey,
} from "./key-fingerprint";

// Key inspection lives in a runtime-agnostic module so `instrumentation.ts`,
// which is compiled for the Edge Runtime as well, can report on the key without
// dragging Node's `crypto` into an edge bundle. Re-exported here so callers have
// a single import for everything credential-related.
export {
  describeEncryptionKeyProblem,
  ENCRYPTION_KEY_ENV,
  encryptionKeyFingerprint,
  isValidEncryptionKey,
};

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce — the size GCM is specified for
const AUTH_TAG_BYTES = 16;
const VERSION = "v1";
const VERSION_PREFIX = `${VERSION}:`;
const PART_COUNT = 4;

/**
 * Credential fields inside `Integration.config` that must never be stored raw.
 *
 * Keys not on this list are treated as non-secret on purpose: identity and
 * display fields (`pageId`, `pageName`, `phoneNumberId`, `wabaId`,
 * `instagramAccountId`, `connectionSource`, `tokenExpiresAt`, …) are read by the
 * n8n workflows straight from Postgres, and a lookup like
 * `i.config->>'phoneNumberId' = '...'` can only match plaintext.
 *
 * ⚠️ When a new credential field is added to an integration, add it here —
 * a name that is missing from this list is silently written as plaintext.
 */
export const SECRET_CONFIG_KEYS: readonly string[] = [
  "accessToken",
  "pageToken",
  "pageAccessToken",
  "instagramAccessToken",
  "userAccessTokenLongLived",
  "appSecret",
  "clientSecret",
  "verifyToken",
  "webhookVerifyToken",
  "refreshToken",
  "botToken",
  "apiKey",
];

const SECRET_KEY_SET = new Set(SECRET_CONFIG_KEYS);

/** Thrown for every encryption/decryption failure, so callers can catch one type. */
export class IntegrationCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationCryptoError";
  }
}

// -----------------------------------------------------------------------------
// Key management
// -----------------------------------------------------------------------------

// Cached per raw env value (not per process), so editing `.env` during
// development takes effect without a restart, and production reads it once.
let cachedKey: Buffer | null = null;
let cachedKeySource: string | null = null;

function readEncryptionKey(): Buffer {
  const raw = process.env[ENCRYPTION_KEY_ENV]?.trim();

  if (cachedKey && cachedKeySource === raw) {
    return cachedKey;
  }

  const problem = describeEncryptionKeyProblem(raw);

  if (problem) {
    throw new IntegrationCryptoError(
      `${problem}\nIntegration tokens cannot be encrypted or decrypted without it.`
    );
  }

  // decodeEncryptionKey has already validated the shape, so this cannot fail.
  const key = Buffer.from(decodeEncryptionKey(raw) as Uint8Array);

  cachedKey = key;
  cachedKeySource = raw ?? null;
  return key;
}

// -----------------------------------------------------------------------------
// Primitives
// -----------------------------------------------------------------------------

/** True when `value` was produced by `encryptSecret` (and so should be decrypted). */
export function isEncryptedSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(VERSION_PREFIX);
}

/**
 * Encrypt a single secret. The result is safe to store in a `Json` column and is
 * what the n8n decrypt step expects.
 */
export function encryptSecret(plaintext: string): string {
  const key = readEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value read from the database.
 *
 * Values that do not carry the `v1:` prefix are returned unchanged — that is the
 * legacy-plaintext path which lets this ship without a coordinated backfill.
 */
export function decryptSecret(value: string): string {
  if (!isEncryptedSecret(value)) {
    return value;
  }

  const parts = value.split(":");

  if (parts.length !== PART_COUNT) {
    throw new IntegrationCryptoError(
      `Malformed encrypted value: expected ${PART_COUNT} ":"-separated parts, got ${parts.length}.`
    );
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new IntegrationCryptoError(
      `Malformed encrypted value: expected a ${IV_BYTES}-byte IV and a ` +
        `${AUTH_TAG_BYTES}-byte auth tag, got ${iv.length} and ${authTag.length}.`
    );
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, readEncryptionKey(), iv, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // The GCM tag check failed. Either the key is not the one this value was
    // written with, or the ciphertext was altered in the database. Both are
    // config/integrity failures that must be loud — returning the ciphertext
    // here would surface as an unexplainable Meta authentication error instead.
    throw new IntegrationCryptoError(
      `Could not decrypt value. It was encrypted with a different ` +
        `${ENCRYPTION_KEY_ENV}, or the ciphertext was modified. ` +
        `Check that the key matches the one used when the row was written ` +
        `(the boot log prints the loaded key's fingerprint).`
    );
  }
}

// -----------------------------------------------------------------------------
// Config transformation
// -----------------------------------------------------------------------------

/**
 * Prisma's `JsonNull` / `DbNull` sentinels are class instances rather than plain
 * objects. Walking into them would turn them into `{}` and quietly change the
 * meaning of a write, so they are passed through untouched. Dates and Decimals
 * are skipped by the same check, for the same reason.
 */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function transformByKey<T>(node: T, transform: (secret: string) => string): T {
  if (Array.isArray(node)) {
    return node.map((entry) => transformByKey(entry, transform)) as unknown as T;
  }

  if (node !== null && typeof node === "object" && isPlainObject(node as object)) {
    const source = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      if (SECRET_KEY_SET.has(key) && typeof value === "string" && value.length > 0) {
        result[key] = transform(value);
      } else {
        result[key] = transformByKey(value, transform);
      }
    }

    return result as unknown as T;
  }

  return node;
}

/**
 * Encrypt every secret field in an `Integration.config` payload before it is
 * written. Non-secret keys are left byte-identical so n8n's SQL lookups keep
 * matching.
 */
export function encryptConfigSecrets<T>(config: T): T {
  return transformByKey(config, encryptSecret);
}

/** Decrypt every secret field in an `Integration.config` payload read from the DB. */
export function decryptConfigSecrets<T>(config: T): T {
  return transformByKey(config, decryptSecret);
}

/**
 * Names of the secret fields in a config that are still plaintext, i.e. the ones
 * a backfill would rewrite. Returns `[]` when the config is fully encrypted.
 *
 * Used by `scripts/encrypt-integration-secrets.ts` so the dry run reports exactly
 * what a real run would change.
 */
export function findPlaintextSecretKeys(config: unknown): string[] {
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }

  if (!isPlainObject(config as object)) {
    return [];
  }

  return Object.entries(config as Record<string, unknown>)
    .filter(([key, value]) => {
      if (!SECRET_KEY_SET.has(key)) return false;
      if (typeof value !== "string" || value.length === 0) return false;
      return !isEncryptedSecret(value);
    })
    .map(([key]) => key);
}
