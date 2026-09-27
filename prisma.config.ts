import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema/",
  datasource: {
    // Prisma 7's `defineConfig` no longer accepts `directUrl` — the CLI uses this
    // single URL, while the app itself connects through its own driver adapter
    // (see lib/core/db.ts). `DATABASE_URL` is the one proven to work with
    // `prisma db push` here; point this at `DIRECT_URL` if DDL ever fails.
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "npx tsx scripts/seed-platforms.ts",
  },
});
