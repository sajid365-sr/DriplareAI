import crypto from "crypto";

/**
 * Verify a Meta webhook payload against its `X-Hub-Signature-256` header.
 *
 * Meta signs the RAW request body with the app secret, so callers must pass the
 * unparsed body — re-serialising a parsed object will not match the signature.
 *
 * Fails closed: a missing secret, a missing or malformed header, or any
 * mismatch returns false.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

  if (!appSecret) {
    console.warn(
      "[meta-signature] META_APP_SECRET / FACEBOOK_APP_SECRET is not configured — rejecting webhook."
    );
    return false;
  }

  if (!signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const signature = parts[1];
  const expectedSignature = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  // timingSafeEqual throws when the buffers differ in length; check up front so
  // the intent is explicit rather than relying on the catch below.
  if (signature.length !== expectedSignature.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch {
    return false;
  }
}
