/**
 * Copies the canonical node definitions into the three channel adapters.
 *
 * The Facebook, Instagram and WhatsApp workflows share six nodes that must read
 * identically on every channel. `lib/n8n/shared-nodes.json` is the one place
 * those six are defined; this script writes them out.
 *
 *   npm run n8n:sync              # write the shared nodes into the adapters
 *   npx tsx scripts/sync-n8n-shared-nodes.ts --check   # report only, exit 1 if stale
 *
 * `npm test` runs the same comparison (lib/n8n/workflow-drift.test.ts), so
 * forgetting to sync after editing a canonical node fails the suite rather than
 * shipping one channel behind the others.
 *
 * ⚠️ Editing a file here does NOT change n8n. The user imports the JSON by hand;
 * after syncing, re-import the affected workflows.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  ADAPTERS,
  applyCanonicalNodes,
  findDrift,
  loadCanonical,
  serializeWorkflow,
  type WorkflowFile,
} from "../lib/n8n/shared-nodes";

const CHECK_ONLY = process.argv.includes("--check");

const root = process.cwd();
const workflowDir = join(root, "docs", "n8n-JSON");
const doc = loadCanonical(root);

console.log(`Canonical nodes (${doc.nodes.length}): ${doc.nodes.map((node) => node.name).join(" · ")}`);
console.log(CHECK_ONLY ? "Mode: check only\n" : "Mode: write\n");

let stale = 0;
let unwritable = 0;

for (const { file, platform } of ADAPTERS) {
  const path = join(workflowDir, file);
  const workflow = JSON.parse(readFileSync(path, "utf8")) as WorkflowFile;
  const drift = findDrift(workflow, doc, platform);

  if (drift.length === 0) {
    console.log(`✅ ${file} — in sync`);
    continue;
  }

  stale++;

  console.log(`✳️  ${file}  (platform: ${platform})`);
  for (const entry of drift) {
    console.log(`     · ${entry.node} — ${describe(entry.kind)}`);
  }

  // A missing node is not drift to paper over: the workflow's shape changed, and
  // writing the node back without an id or a position could produce a file n8n
  // refuses to import. Report it and leave the file alone.
  const missing = drift.filter((entry) => entry.kind === "missing");
  if (missing.length > 0) {
    unwritable++;
    console.log(`     → NOT written: ${missing.length} node(s) are missing, so the file needs a human first.`);
    continue;
  }

  if (CHECK_ONLY) continue;

  applyCanonicalNodes(workflow, doc, platform);
  writeFileSync(path, serializeWorkflow(workflow), "utf8");
  console.log("     → written");
}

function describe(kind: string): string {
  switch (kind) {
    case "missing":
      return "missing from the workflow";
    case "type":
      return "wrong node type";
    case "typeVersion":
      return "wrong node type version";
    default:
      return "parameters differ from the canonical definition";
  }
}

console.log("");

if (unwritable > 0) {
  console.error(`✖ ${unwritable} file(s) need a human before this script can fix them.`);
  process.exit(1);
}

if (stale === 0) {
  console.log("All adapters match the canonical definitions.");
} else if (CHECK_ONLY) {
  console.error(`✖ ${stale} file(s) are stale. Run \`npm run n8n:sync\`, then re-import them into n8n.`);
  process.exit(1);
} else {
  console.log(`✔ Updated ${stale} file(s). Re-import them into n8n for the change to take effect.`);
}
