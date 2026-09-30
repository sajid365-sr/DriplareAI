#!/usr/bin/env node
/**
 * Next.js build/cache cleaner.
 *
 * Why this exists: Next.js 16 keeps a persistent Turbopack cache in
 * `.next/dev/cache/turbopack`. A dev-server restart does NOT clear it — the
 * cache is restored from disk, so a stale route tree keeps serving 404s for
 * dynamic routes long after the source is fixed. Deleting `.next` is the
 * reliable cure, and this script makes that a single command on every platform.
 *
 * Usage:
 *   node scripts/clean-next.mjs all     → removes the whole `.next` (default)
 *   node scripts/clean-next.mjs cache   → removes only the caches, keeps dev output
 */

import { existsSync, rmSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** Cleanup targets, keyed by the CLI argument. */
const TARGETS = {
  all: [".next"],
  cache: [".next/dev/cache", ".next/cache"],
};

const mode = process.argv[2] ?? "all";
const targets = TARGETS[mode];

if (!targets) {
  console.error(`Unknown target "${mode}". Expected one of: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}

/** Recursively sums file sizes so the log shows how much disk was freed. */
function directorySize(target) {
  let total = 0;
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    const child = join(target, entry.name);
    try {
      if (entry.isDirectory()) total += directorySize(child);
      else total += statSync(child).size;
    } catch {
      // A file can vanish mid-walk (or be locked); its size just doesn't count.
    }
  }
  return total;
}

/** Formats a byte count as MB/GB, whichever reads better. */
function formatSize(bytes) {
  const mb = bytes / 1024 ** 2;
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
}

let freed = 0;

for (const target of targets) {
  const absolute = join(ROOT, target);

  if (!existsSync(absolute)) {
    console.log(`skip     ${target} (not present)`);
    continue;
  }

  const size = directorySize(absolute);
  rmSync(absolute, { recursive: true, force: true });
  freed += size;
  console.log(`removed  ${target} (${formatSize(size)})`);
}

console.log(`\nDone. Freed ${formatSize(freed)}.`);
