import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for shared secrets.
 *
 * `a !== b` short-circuits on the first differing byte, so the time it takes to
 * reject a guess leaks how many leading characters were correct — enough to
 * recover a secret one byte at a time given enough requests. Every server-to-
 * server endpoint that trusts a header secret (`/api/internal/*`, the cron
 * routes, the automation gate) needs this comparison instead.
 *
 * Fails flat rather than descriptively: a missing value on either side, or a
 * length mismatch, returns `false`. The length is checked before calling
 * `timingSafeEqual` because that function *throws* on unequal lengths — letting
 * it throw would leak the secret's length through the error path instead of
 * through timing, which is the same leak wearing a different coat.
 */
export function timingSafeEqualString(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  // An unset `expected` must never authorise anything — otherwise a missing env
  // var turns into an open door, because `undefined === undefined` is true.
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
