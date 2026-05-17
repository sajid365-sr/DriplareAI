import "dotenv/config"; // Explicitly load .env across all Next.js worker threads
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: any };

function createPrismaClient(): PrismaClient {
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

// Defer client instantiation and only cache once DATABASE_URL is fully loaded at runtime
function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    return createPrismaClient();
  } else {
    if (!globalForPrisma.prisma && process.env.DATABASE_URL) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma || createPrismaClient();
  }
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
