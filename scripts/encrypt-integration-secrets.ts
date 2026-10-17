/**
 * Backfill: encrypt the credential fields already stored in
 * `Integration.config` (TASK-08).
 *
 * ## When to run this
 *
 * Only AFTER the n8n workflows that read these tokens from Postgres have been
 * updated to decrypt them. n8n does not read tokens through this app — it runs
 * `SELECT i.config->>'pageToken' ...` against the database directly — so the
 * moment a row becomes `v1:...`, a workflow that has no decrypt step will send
 * that ciphertext to Meta as an access token and every reply on that channel
 * will fail.
 *
 * The correct order is documented in `docs/integration-token-encryption.md`:
 *
 *     n8n decrypt step deployed  →  app deployed  →  this script  →  verify
 *
 * ## Safety
 *
 * - This script performs **no writes unless `--apply` is passed.** A bare run is
 *   a dry run and reports exactly what would change.
 * - It reads through an *unextended* Prisma client on purpose. Through the app's
 *   usual client, reads come back decrypted, which makes an already-encrypted
 *   row indistinguishable from a plaintext one and would cause double
 *   encryption on the write-back.
 * - Token values are never printed — only the field names that would change and
 *   the character length, which is enough to spot an unexpected value.
 *
 * ## Usage
 *
 *     npm run secrets:audit      # dry run — reports only
 *     npm run secrets:encrypt    # writes — requires the encryption key and the
 *                                # n8n decrypt step to already be live
 */

import "dotenv/config";

import { createBasePrismaClient } from "../lib/core/db";
import {
  ENCRYPTION_KEY_ENV,
  SECRET_CONFIG_KEYS,
  describeEncryptionKeyProblem,
  encryptConfigSecrets,
  encryptionKeyFingerprint,
  findPlaintextSecretKeys,
  isEncryptedSecret,
} from "../lib/core/crypto";

const SECRET_KEY_SET = new Set(SECRET_CONFIG_KEYS);

type IntegrationRow = {
  id: string;
  chatbotId: string;
  platform: string;
  config: unknown;
};

type PlanEntry = {
  row: IntegrationRow;
  plaintextKeys: string[];
  alreadyEncryptedKeys: string[];
};

const apply = process.argv.includes("--apply");

function maskLength(value: unknown): string {
  return typeof value === "string" ? `${value.length} chars` : "n/a";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

async function main() {
  const rawKey = process.env[ENCRYPTION_KEY_ENV];
  const keyProblem = describeEncryptionKeyProblem(rawKey);

  if (keyProblem) {
    console.error(`\n✖ ${ENCRYPTION_KEY_ENV} is unusable — ${keyProblem}\n`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n🔑 ${ENCRYPTION_KEY_ENV} fingerprint: ${await encryptionKeyFingerprint(rawKey)}`);
  console.log(`   Mode: ${apply ? "APPLY (writes to the database)" : "DRY RUN (no writes)"}\n`);

  const prisma = createBasePrismaClient();

  try {
    const rows = (await prisma.integration.findMany({
      select: { id: true, chatbotId: true, platform: true, config: true },
      orderBy: [{ platform: "asc" }, { chatbotId: "asc" }],
    })) as IntegrationRow[];

    const plan: PlanEntry[] = [];

    for (const row of rows) {
      const plaintextKeys = findPlaintextSecretKeys(row.config);

      // Computed independently of `plaintextKeys` so a half-migrated row (one
      // field encrypted, another still plaintext) shows up as exactly that
      // instead of looking finished.
      const alreadyEncryptedKeys = isPlainRecord(row.config)
        ? Object.entries(row.config)
            .filter(([key, value]) => SECRET_KEY_SET.has(key) && isEncryptedSecret(value))
            .map(([key]) => key)
        : [];

      if (plaintextKeys.length > 0 || alreadyEncryptedKeys.length > 0) {
        plan.push({ row, plaintextKeys, alreadyEncryptedKeys });
      }
    }

    const toChange = plan.filter((entry) => entry.plaintextKeys.length > 0);
    const alreadyDone = plan.filter(
      (entry) => entry.plaintextKeys.length === 0 && entry.alreadyEncryptedKeys.length > 0
    );
    const withoutSecrets = rows.length - plan.length;

    console.log(`Scanned ${rows.length} integration row(s).\n`);

    if (toChange.length > 0) {
      console.log(`Rows that still hold plaintext credentials (${toChange.length}):`);
      for (const { row, plaintextKeys } of toChange) {
        const details = plaintextKeys
          .map((key) => `${key} (${maskLength((row.config as Record<string, unknown>)[key])})`)
          .join(", ");
        console.log(`  • ${row.platform.padEnd(10)} ${row.chatbotId}  →  ${details}`);
      }
      console.log("");
    }

    if (alreadyDone.length > 0) {
      console.log(`Rows already encrypted (${alreadyDone.length}):`);
      for (const { row } of alreadyDone) {
        console.log(`  • ${row.platform.padEnd(10)} ${row.chatbotId}`);
      }
      console.log("");
    }

    console.log(
      `Summary: ${toChange.length} to encrypt · ${alreadyDone.length} already encrypted · ` +
        `${withoutSecrets} without credentials · ${rows.length} total\n`
    );

    if (toChange.length === 0) {
      console.log("✅ Nothing to do — every stored credential is already encrypted.\n");
      return;
    }

    if (!apply) {
      console.log(
        "ℹ️  Dry run — nothing was written.\n" +
          "   Before applying, confirm:\n" +
          "     1. every affected n8n workflow has the decrypt step deployed, and\n" +
          "     2. n8n's INTEGRATION_ENCRYPTION_KEY has the same fingerprint printed above.\n" +
          "   Then run: npm run secrets:encrypt\n"
      );
      return;
    }

    let updated = 0;

    for (const { row, plaintextKeys } of toChange) {
      // The base client is not extended, so this value is written exactly as
      // given — no second encryption pass.
      const encryptedConfig = encryptConfigSecrets(row.config);

      await prisma.integration.update({
        where: { id: row.id },
        data: { config: encryptedConfig as never },
      });

      updated += 1;
      console.log(
        `  ✔ ${row.platform.padEnd(10)} ${row.chatbotId}  (${plaintextKeys.join(", ")})`
      );
    }

    console.log(`\n✅ Encrypted ${updated} row(s).\n`);
    console.log(
      "Next: send a test message on each channel (Facebook, WhatsApp, Instagram) and\n" +
        "confirm a reply comes back, then re-run `npm run secrets:audit` — it should\n" +
        "report 0 rows to encrypt.\n"
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("\n✖ Backfill failed:", error);
  process.exitCode = 1;
});
