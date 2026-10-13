import "dotenv/config"; // Explicitly load .env across all Next.js worker threads
import { PrismaClient } from "@prisma/client";

import { integrationEncryptionExtension } from "./db-encryption";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaConnectionString?: string;
};

/**
 * Build a client with no query extensions applied.
 *
 * Exported for maintenance scripts (`scripts/encrypt-integration-secrets.ts`)
 * that must see the raw stored bytes: through an extended client a read would
 * hand back a decrypted config, which makes it impossible to tell an
 * already-encrypted row from a plaintext one.
 */
export function createBasePrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (!databaseUrl) {
    console.log("[db.ts] DATABASE_URL is empty during boot. Returning standard client fallback.");
    return new PrismaClient();
  }

  const isNeon = databaseUrl.includes("neon.tech");
  console.log(`[db.ts] Initializing database client. isNeon: ${isNeon}, URL length: ${databaseUrl.length}`);

  if (isNeon) {
    // Neon Serverless (Development / Preview) Setup
    const { PrismaNeon } = require("@prisma/adapter-neon");
    const ws = require("ws");
    const { neonConfig } = require("@neondatabase/serverless");

    // Configure WebSocket globally on the neon driver
    neonConfig.webSocketConstructor = ws;
    
    // Pass connectionString directly to PrismaNeon (Recommended approach)
    const adapter = new PrismaNeon({ connectionString: databaseUrl });
    
    return new PrismaClient({ adapter } as any);
  } else {
    // Traditional Postgres (Hostinger VPS / Production) Setup
    const { PrismaPg } = require("@prisma/adapter-pg");

    // Pass connectionString directly to PrismaPg (Recommended approach)
    const adapter = new PrismaPg({ connectionString: databaseUrl });

    return new PrismaClient({ adapter } as any);
  }
}

// Resolve the shared PrismaClient for this process.
//
// The client is cached on `globalThis` and rebuilt only when the connection
// string actually changes. Keying the cache on the URL (instead of on
// NODE_ENV) keeps two things working at once:
//
//   1. the boot case where env vars are not loaded on the very first call, and
//   2. the common case — rebuilding per query opened a fresh connection pool
//      on every access, which exhausted Postgres connections.
//
// The `$extends` wrapper adds transparent encryption of `Integration.config`;
// see lib/core/db-encryption.ts. It is cast back to `PrismaClient` on purpose so
// the ~40 existing call sites keep their types and need no changes.
function getPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL || "";

  if (globalForPrisma.prisma && globalForPrisma.prismaConnectionString === databaseUrl) {
    return globalForPrisma.prisma;
  }

  const previous = globalForPrisma.prisma;
  const client = createBasePrismaClient().$extends(
    integrationEncryptionExtension
  ) as unknown as PrismaClient;

  globalForPrisma.prisma = client;
  globalForPrisma.prismaConnectionString = databaseUrl;

  // Release the previous pool. This only runs when the connection string
  // changed, so it fires at most once per process.
  if (previous) {
    void previous.$disconnect().catch(() => {});
  }

  return client;
}

// Export db as a lazy Proxy that forwards all properties to the actual PrismaClient
export const db = new Proxy({} as PrismaClient, {
  get(target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  }
});
