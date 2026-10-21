import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest config.
 *
 * `test.environment` is `node` (the default) on purpose: everything under test
 * here is server-side domain logic — validation rules and secret comparison —
 * with no DOM. A jsdom environment would only slow the suite down.
 *
 * The `@/` alias mirrors `tsconfig.json`'s `paths`, so test files import the
 * same specifiers as the modules they cover.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
  },
});
