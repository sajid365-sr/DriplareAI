/**
 * Transparent encryption for `Integration.config` (TASK-08).
 *
 * ## Why a Prisma extension instead of editing the call sites
 *
 * `db.integration` is written from roughly forty places (integration connect and
 * disconnect routes, OAuth callbacks, Instagram/WhatsApp flows, webhook
 * token-status updates) and read from nearly as many. Encrypting at each call
 * site means two silent failure modes:
 *
 *   - forget one **write** site → that token stays plaintext in the database,
 *     and the leak this task exists to close is still open;
 *   - forget one **read** site → a live channel starts sending with a ciphertext
 *     as its access token, which fails deep inside a Meta API call.
 *
 * Intercepting at the client covers both, once.
 *
 * ## Scope
 *
 * The hooks are registered for the `Integration` model only. Reads decrypt,
 * writes encrypt. Everything else — `Chatbot`, `ChatMessage`, `ChatSession` —
 * is untouched, so no query gains avoidable overhead or behaviour change.
 *
 * ⚠️ Prisma extensions do **not** apply to `$transaction` clients. There is no
 * `tx.integration` call site today; if one is added it must encrypt explicitly,
 * or the token will be stored in plaintext.
 */

import { Prisma } from "@prisma/client";

import { decryptConfigSecrets, encryptConfigSecrets } from "./crypto";

/** Operations whose `data` payload may contain a `config` field to encrypt. */
const WRITE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);

/**
 * Operations that resolve to `Integration` rows. `aggregate`, `groupBy` and
 * `count` are deliberately absent — they return computed shapes, not rows, and
 * have no `config` to decrypt.
 */
const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
]);

type QueryArgs = Record<string, unknown>;

/** Encrypt `config` on a create/update `data` payload. */
function encryptData(data: unknown): unknown {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }

  const record = { ...(data as QueryArgs) };

  if ("config" in record) {
    record.config = encryptConfigSecrets(record.config);
  }

  return record;
}

function encryptWriteArgs(args: unknown): unknown {
  if (args === null || typeof args !== "object") {
    return args;
  }

  const next = { ...(args as QueryArgs) };

  // create / update / updateMany / createMany
  if ("data" in next) {
    next.data = Array.isArray(next.data)
      ? next.data.map((entry) => encryptData(entry))
      : encryptData(next.data);
  }

  // upsert carries two independent payloads; both can create the row.
  if ("create" in next) {
    next.create = encryptData(next.create);
  }

  if ("update" in next) {
    next.update = encryptData(next.update);
  }

  return next;
}

function decryptRow(row: unknown): unknown {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    return row;
  }

  const record = row as QueryArgs;

  // A `select` that omits `config` leaves the key absent — nothing to do.
  if (!("config" in record)) {
    return row;
  }

  return { ...record, config: decryptConfigSecrets(record.config) };
}

function decryptResult(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.map(decryptRow);
  }

  return decryptRow(result);
}

/**
 * Query extension applied to the shared client in `lib/core/db.ts`.
 *
 * The cast on the return value is required because Prisma types `$allOperations`
 * against a per-model argument union; the runtime contract is simply "return
 * something awaitable that resolves to the query result", which is what we do.
 */
export const integrationEncryptionExtension = Prisma.defineExtension({
  name: "integration-config-encryption",
  query: {
    integration: {
      $allOperations({ operation, args, query }) {
        const nextArgs = WRITE_OPERATIONS.has(operation) ? encryptWriteArgs(args) : args;

        if (!READ_OPERATIONS.has(operation)) {
          return query(nextArgs as typeof args);
        }

        // Decryption happens after the query resolves, so a corrupt row reports
        // the integration it belongs to instead of failing inside the driver.
        return (query(nextArgs as typeof args) as Promise<unknown>).then((result) => {
          try {
            return decryptResult(result);
          } catch (error) {
            // Gracefully degrade: log the decryption failure but return the
            // raw result rather than crashing the entire request. This handles
            // the case where INTEGRATION_ENCRYPTION_KEY is missing in local dev
            // but rows were encrypted in production with a different key.
            const id = (result as QueryArgs | null)?.id;
            const suffix = typeof id === "string" ? ` (integration ${id})` : "";
            console.warn(
              `[integration-encryption] Failed to decrypt Integration.config${suffix}. ` +
                (error instanceof Error ? error.message : String(error)) +
                " — returning raw (possibly encrypted) config."
            );
            return result;
          }
        }) as never;
      },
    },
  },
});
