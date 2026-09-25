import "dotenv/config";
import { db } from "../lib/core/db";

/**
 * Stripe অপসারণ — one-off data cleanup
 * ─────────────────────────────────────────────────────────────────────────────
 * সাইট থেকে Stripe সম্পূর্ণ বাদ দেওয়ার পর পুরনো Stripe transaction-গুলো DB-তে
 * পড়ে থাকলে admin panel-এর payment history ও revenue report ভুল দেখাত।
 * এই script সেগুলো মুছে দেয়।
 *
 * ⚠️ **অপরিবর্তনীয় (irreversible)** — চালানোর আগে DB backup নিন।
 *     Neon snapshot, অথবা:  pg_dump "$DATABASE_URL" > backup.sql
 *
 * ⚠️ credit **কাটা হয় না** — যে merchant Stripe-এ টাকা দিয়ে credit পেয়েছিলেন,
 *     তার credit অক্ষত থাকবে; শুধু audit row-টি চলে যাবে। এটি ইচ্ছাকৃত, কারণ
 *     credit কাটা একটি আলাদা business decision।
 *
 * চালানোর নিয়ম:
 *     npx tsx scripts/remove-stripe.ts            # শুধু দেখায় (dry run)
 *     npx tsx scripts/remove-stripe.ts --confirm  # সত্যিই মুছে ফেলে
 *
 * Prisma schema-তে কোনো পরিবর্তন নেই (`gateway` একটি String column), তাই
 * `prisma migrate` লাগে না — ইচ্ছাকৃতভাবে, কারণ production-এ destructive SQL
 * অটো-apply হওয়া বিপজ্জনক।
 */

const CONFIRM_FLAG = "--confirm";

async function main() {
  const confirmed = process.argv.includes(CONFIRM_FLAG);

  // ── ১. কতগুলো Stripe transaction আছে ────────────────────────────────────────
  const stripeTransactions = await db.paymentTransaction.findMany({
    where: { gateway: "stripe" },
    select: { id: true, sessionId: true, amount: true, currency: true, grantedAt: true },
  });

  const grantedCount = stripeTransactions.filter((tx) => tx.grantedAt).length;

  console.log(`\nFound ${stripeTransactions.length} Stripe transaction(s).`);
  console.log(`  → ${grantedCount} of them already granted credits (credits stay untouched).`);

  if (stripeTransactions.length === 0) {
    console.log("Nothing to delete. Exiting.\n");
    return;
  }

  // ── ২. ওই transaction-গুলোর refund request ─────────────────────────────────
  const transactionIds = stripeTransactions.map((tx) => tx.id);

  const orphanRefundRequests = await db.refundRequest.count({
    where: { transactionId: { in: transactionIds } },
  });

  console.log(`  → ${orphanRefundRequests} linked refund request(s) will also be deleted.`);

  if (!confirmed) {
    console.log(
      `\n[DRY RUN] কিছুই মুছে ফেলা হয়নি। সত্যিই মুছতে চাইলে:\n` +
        `  npx tsx scripts/remove-stripe.ts ${CONFIRM_FLAG}\n`
    );
    return;
  }

  // ── ৩. মুছে ফেলা — refund request আগে, কারণ FK transaction-এর দিকে ──────────
  const deletedRequests = await db.refundRequest.deleteMany({
    where: { transactionId: { in: transactionIds } },
  });

  const deletedTransactions = await db.paymentTransaction.deleteMany({
    where: { gateway: "stripe" },
  });

  console.log(`\n✅ Deleted ${deletedRequests.count} refund request(s).`);
  console.log(`✅ Deleted ${deletedTransactions.count} Stripe transaction(s).`);
  console.log(
    `\nℹ️ ${grantedCount} merchant-এর credit অক্ষত আছে — শুধু audit row মুছে গেছে.\n`
  );
}

main()
  .catch((e) => {
    console.error("[REMOVE_STRIPE_ERROR]", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
