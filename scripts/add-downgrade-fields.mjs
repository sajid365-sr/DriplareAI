/**
 * Migration script: Add scheduled downgrade fields to User table
 * Run: node scripts/add-downgrade-fields.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("🔄 Adding scheduledDowngradePlan and scheduledDowngradeAt columns...");

  try {
    // Add scheduledDowngradePlan column if it doesn't exist
    await db.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "scheduledDowngradePlan" TEXT,
      ADD COLUMN IF NOT EXISTS "scheduledDowngradeAt" TIMESTAMP(3);
    `);
    console.log("✅ Columns added successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

main();
