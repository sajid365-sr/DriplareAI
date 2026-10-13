/**
 * Prisma error-code helpers.
 *
 * `err instanceof Prisma.PrismaClientKnownRequestError` couples the caller to
 * the generated client's class identity, which differs between the library
 * engine and the driver adapters this project uses. A plain `code` check works
 * in both, and keeps the call sites readable.
 */

/** Prisma P2002 — a unique constraint was violated. */
export function isUniqueViolation(error: unknown): boolean {
  return hasPrismaCode(error, "P2002");
}

/** Prisma P2025 — the record a write expected to find does not exist. */
export function isRecordNotFound(error: unknown): boolean {
  return hasPrismaCode(error, "P2025");
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
