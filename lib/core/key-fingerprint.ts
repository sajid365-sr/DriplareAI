/**
 * Runtime-agnostic inspection of `INTEGRATION_ENCRYPTION_KEY`.
 *
 * This lives apart from `lib/core/crypto.ts` for one concrete reason: that
 * module imports Node's `crypto` builtin to run AES-256-GCM, which does not
 * exist in the Edge Runtime. `instrumentation.ts` is compiled for *both*
 * runtimes, so anything it imports must work in both — hence WebCrypto and
 * `atob` here rather than node:crypto.
 *
 * The key fingerprint is the first 8 hex characters of SHA-256 over the raw key
 * bytes. It exists so the app's boot log and n8n's environment can be compared
 * when decryption starts failing, without the key itself ever being logged or
 * moved between systems. It is a diagnostic, never a security boundary.
 */

/** Environment variable holding the base64-encoded 32-byte master key. */
export const ENCRYPTION_KEY_ENV = "INTEGRATION_ENCRYPTION_KEY";

/** AES-256 requires exactly 32 bytes of key material. */
export const KEY_BYTES = 32;

/** Decode base64 key material into raw bytes, or `null` when it is not base64. */
export function decodeEncryptionKey(raw: string | null | undefined): Uint8Array | null {
  const trimmed = raw?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const binary = atob(trimmed);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

/**
 * Describe why the key cannot be used, or `null` when it is fine.
 *
 * The message is written for whoever is reading a boot log at 2am, so it names
 * the likely cause and the command that fixes it rather than just "invalid key".
 */
export function describeEncryptionKeyProblem(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return (
      `${ENCRYPTION_KEY_ENV} is not set. Generate one with:\n` +
      `  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }

  const bytes = decodeEncryptionKey(raw);

  if (!bytes) {
    return `${ENCRYPTION_KEY_ENV} is not valid base64.`;
  }

  if (bytes.length !== KEY_BYTES) {
    return (
      `${ENCRYPTION_KEY_ENV} must decode to exactly ${KEY_BYTES} bytes ` +
      `(got ${bytes.length}). Expected the base64 encoding of a 32-byte key.`
    );
  }

  return null;
}

/** True when the value is a usable 32-byte base64 key. */
export function isValidEncryptionKey(raw: string | null | undefined): boolean {
  return describeEncryptionKeyProblem(raw) === null;
}

/**
 * Short fingerprint of the key, for cross-environment comparison.
 *
 * Throws when the key is unusable — callers check `describeEncryptionKeyProblem`
 * first, so a throw here means a genuine programming mistake.
 */
export async function encryptionKeyFingerprint(raw: string | null | undefined): Promise<string> {
  const bytes = decodeEncryptionKey(raw);

  if (!bytes || bytes.length !== KEY_BYTES) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is unusable; cannot compute a fingerprint.`);
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 8);
}
