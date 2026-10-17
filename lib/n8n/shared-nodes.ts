import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Single source of truth for the n8n nodes the three channel adapters share.
 *
 * Facebook, Instagram and WhatsApp are three separate n8n workflows, and n8n
 * links them to nothing. Fixing a shared node in one and forgetting the others
 * leaves the product behaving differently per channel with no error anywhere —
 * the forgotten channel simply keeps the old behaviour.
 *
 * `shared-nodes.json` holds the canonical definition of every node that must
 * read the same on all three. This module turns that file into the two things
 * that need it: the comparison `workflow-drift.test.ts` runs on every
 * `npm test`, and the rewrite `scripts/sync-n8n-shared-nodes.ts` performs. Both
 * go through the same code so the check and the fix can never disagree.
 *
 * ## Why a sync script and not a sub-workflow
 *
 * n8n could share these at run time via an `executeWorkflow` call, but that
 * costs one extra execution per inbound message and — decisively — it cannot
 * share `Respond 200 to Meta` or `Return hub.challenge` at all, because a
 * `respondToWebhook` node has to live in the workflow that owns the webhook.
 * Writing the definitions into all three files at sync time has no such limit,
 * costs nothing at run time, and the drift test makes forgetting to run it
 * impossible.
 */

/** The channel adapters, and the platform each one is. */
export const ADAPTERS = [
  { file: "Facebook-Integration.json", platform: "facebook" },
  { file: "Instagram-Integration.json", platform: "instagram" },
  { file: "WhatsApp-Integration.json", platform: "whatsapp" },
] as const;

export interface CanonicalNode {
  name: string;
  type: string;
  typeVersion: number;
  /** True when `parameters` contains the platform token and must be substituted. */
  templated: boolean;
  parameters: Record<string, unknown>;
}

export interface CanonicalDoc {
  description: string;
  templatedToken: string;
  nodes: CanonicalNode[];
}

/** An n8n node, as far as this module cares. */
export interface WorkflowNode {
  name: string;
  type?: string;
  typeVersion?: number;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
}

/** An n8n workflow file. Everything outside `nodes` is left untouched. */
export interface WorkflowFile {
  nodes: WorkflowNode[];
  [key: string]: unknown;
}

export type DriftKind = "missing" | "type" | "typeVersion" | "parameters";

export interface Drift {
  node: string;
  kind: DriftKind;
}

export function loadCanonical(root = process.cwd()): CanonicalDoc {
  return JSON.parse(readFileSync(join(root, "lib", "n8n", "shared-nodes.json"), "utf8")) as CanonicalDoc;
}

/**
 * JSON with object keys sorted, so a re-export from n8n is not mistaken for
 * drift. Array order is preserved: the order of `conditions` in an If node
 * carries meaning, and reordering them IS drift.
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    return "{" + entries.map(([key, entry]) => JSON.stringify(key) + ":" + stable(entry)).join(",") + "}";
  }

  return JSON.stringify(value) ?? "null";
}

/** The parameter block an adapter must carry for `node` on `platform`. */
export function expectedParameters(node: CanonicalNode, platform: string, token: string): Record<string, unknown> {
  // split/join rather than a regex: the token contains characters a regex would
  // treat specially, and this file is compared byte-for-byte by the test.
  return JSON.parse(JSON.stringify(node.parameters).split(token).join(platform)) as Record<string, unknown>;
}

/** Every node the sync owns, in canonical order. */
export function canonicalNodeNames(doc: CanonicalDoc): string[] {
  return doc.nodes.map((node) => node.name);
}

/** How `workflow` differs from the canonical definitions for `platform`. */
export function findDrift(workflow: WorkflowFile, doc: CanonicalDoc, platform: string): Drift[] {
  const drift: Drift[] = [];

  for (const node of doc.nodes) {
    const actual = workflow.nodes.find((candidate) => candidate.name === node.name);

    if (!actual) {
      drift.push({ node: node.name, kind: "missing" });
      continue;
    }

    if (actual.type !== node.type) drift.push({ node: node.name, kind: "type" });
    if (actual.typeVersion !== node.typeVersion) drift.push({ node: node.name, kind: "typeVersion" });

    if (stable(actual.parameters) !== stable(expectedParameters(node, platform, doc.templatedToken))) {
      drift.push({ node: node.name, kind: "parameters" });
    }
  }

  return drift;
}

/**
 * Writes the canonical definitions into `workflow`, in place.
 *
 * Only `type`, `typeVersion` and `parameters` are touched. `id`, `position`,
 * `credentials`, `continueOnFail` and everything else stay exactly as the
 * adapter had them — those are per-file facts, not shared ones.
 *
 * Nodes absent from the workflow are left absent; the caller reports them. A
 * missing node means the workflow's shape changed, and silently recreating it
 * without an `id` or a position would produce a file n8n may reject.
 */
export function applyCanonicalNodes(workflow: WorkflowFile, doc: CanonicalDoc, platform: string): boolean {
  let changed = false;

  for (const node of doc.nodes) {
    const actual = workflow.nodes.find((candidate) => candidate.name === node.name);
    if (!actual) continue;

    const expected = expectedParameters(node, platform, doc.templatedToken);

    if (actual.type !== node.type) {
      actual.type = node.type;
      changed = true;
    }

    if (actual.typeVersion !== node.typeVersion) {
      actual.typeVersion = node.typeVersion;
      changed = true;
    }

    if (stable(actual.parameters) !== stable(expected)) {
      actual.parameters = expected;
      changed = true;
    }
  }

  return changed;
}

/** n8n's own export formatting: two-space JSON with a trailing newline. */
export function serializeWorkflow(workflow: WorkflowFile): string {
  return JSON.stringify(workflow, null, 2) + "\n";
}
