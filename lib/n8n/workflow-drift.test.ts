import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ADAPTERS, findDrift, loadCanonical, type WorkflowFile } from "./shared-nodes";

/**
 * Guards the channel adapters against silent divergence.
 *
 * TASK-14 exists because Facebook, Instagram and WhatsApp are three separate
 * n8n workflows that share a skeleton. Nothing in n8n links them: fixing a bug
 * in one and forgetting the other two leaves the product behaving differently
 * per channel, with no error anywhere — the forgotten channel simply keeps the
 * old behaviour. That is a quiet divergence, and quiet is what makes it costly.
 *
 * This file is the link n8n does not provide. It reads the exported workflows
 * and fails `npm test` the moment they drift, so the reminder arrives while the
 * change is still in hand rather than months later on one channel only.
 *
 * The six nodes that must read identically everywhere are defined once, in
 * `lib/n8n/shared-nodes.json`. `npm run n8n:sync` writes them into all three
 * adapters, and the first describe block below is what makes running it
 * mandatory rather than optional.
 *
 * ## What it deliberately does NOT demand
 *
 * The three adapters are *not* copies: about two thirds of each is genuine
 * per-channel logic (payload normalisation, profile lookup, reply APIs). A test
 * asserting the whole files match would be a test that everyone deletes. So the
 * assertions below cover only the parts whose meaning carries no channel — plus
 * the values that encode *which channel this workflow is*, where a copy-paste
 * slip is both easy and invisible.
 */

const WORKFLOW_DIR = join(process.cwd(), "docs", "n8n-JSON");
const canonical = loadCanonical();

/**
 * Workflows kept only so a node can be pasted into the n8n editor.
 *
 * They are not importable workflows — `Automation-Gate.json` holds one copied
 * node whose expressions name nodes that live in Core-AI-Brain — so the
 * reference check below must not treat them as standalone.
 */
const FRAGMENTS = new Set(["Automation-Gate.json"]);

/** Every workflow that runs the shared brain. */
const BRAIN_CALLERS = [...ADAPTERS.map((adapter) => adapter.file), "Web-Playground-Integration.json"];

/**
 * The skeleton every adapter must still be built from.
 *
 * The per-channel nodes differ (`Normalize X Payload`, the send nodes, the echo
 * check); these are the steps in between, and every one of them is also a
 * canonical node or a direct neighbour of one. A missing step breaks the chain,
 * and an n8n workflow with a broken chain does not error — it just stops.
 */
const SPINE_NODES = [
  "Webhook",
  "If Webhook Verify",
  "Return hub.challenge",
  "Respond 200 to Meta",
  "Fetch Integration",
  "Decrypt Integration Secrets",
  "Guard Active",
  "Build Brain Payload",
  "Upsert Chat Session",
  "Execute Core AI Brain",
  "Route Reply Type",
  "Split Gallery",
];

function loadWorkflow(file: string): WorkflowFile {
  return JSON.parse(readFileSync(join(WORKFLOW_DIR, file), "utf8")) as WorkflowFile;
}

const loaded = new Map(ADAPTERS.map((adapter) => [adapter.file, loadWorkflow(adapter.file)]));

describe("the canonical shared nodes", () => {
  it("are defined, and include the ones a sub-workflow could never share", () => {
    const names = canonical.nodes.map((node) => node.name);

    // The webhook responders are the reason this is a sync script rather than an
    // `executeWorkflow` call: n8n cannot answer a parent's webhook from a
    // sub-workflow, so those two nodes could only ever be shared by writing them
    // into each file. If they ever leave this list, that reasoning has changed.
    expect(names).toContain("Respond 200 to Meta");
    expect(names).toContain("Return hub.challenge");
    expect(names).toContain("Decrypt Integration Secrets");
    expect(names.length).toBeGreaterThanOrEqual(6);
  });

  it("marks exactly the nodes that carry a channel name", () => {
    const templated = canonical.nodes.filter((node) => node.templated).map((node) => node.name);

    // `Upsert Chat Session` writes the platform into the session row, so its SQL
    // is the one definition that legitimately differs per channel. Any other
    // node acquiring a token would mean a channel name leaked into a definition
    // that should have none.
    expect(templated).toEqual(["Upsert Chat Session"]);
  });

  it.each(ADAPTERS)("$file matches them", ({ file, platform }) => {
    // Run `npm run n8n:sync` to fix. This is the assertion that makes the sync
    // step mandatory: edit a canonical node, forget to run it, and this fails.
    //
    // The comparison comes from shared-nodes.ts rather than being written again
    // here, so the check and the script that performs the fix can never disagree
    // about what "in sync" means.
    const drift = findDrift(loaded.get(file)!, canonical, platform).map((entry) => `${entry.node}: ${entry.kind}`);

    expect(drift).toEqual([]);
  });

  it.each(ADAPTERS)("$file still has the whole spine", ({ file }) => {
    // Renaming or deleting a spine node breaks every expression that names it,
    // and n8n reports that only when a real message arrives.
    const names = new Set(loaded.get(file)!.nodes.map((node) => node.name));
    const missing = SPINE_NODES.filter((name) => !names.has(name));

    expect(missing).toEqual([]);
  });
});

describe("each adapter declares the channel it is", () => {
  it.each(ADAPTERS)("$file names $platform in every place that matters", ({ file, platform }) => {
    const workflow = loaded.get(file)!;
    const webhookPath = `driplare-${platform}`;

    // These three values are what make the workflow *this* channel. A copy-paste
    // that updates the webhook path but not the SQL, or the platform input but
    // not the path, yields a workflow that runs perfectly and files every
    // conversation under the wrong channel. The SQL is checked against the
    // canonical definition, so it proves the token was substituted here.
    expect(workflow.nodes.find((node) => node.name === "Webhook")?.parameters?.path).toBe(webhookPath);

    const upsert = workflow.nodes.find((node) => node.name === "Upsert Chat Session");
    expect(JSON.stringify(upsert?.parameters)).toContain(`'${platform}'`);

    const brain = workflow.nodes.find((node) => node.name === "Execute Core AI Brain");
    const inputs = brain?.parameters?.workflowInputs as { value?: Record<string, unknown> } | undefined;
    expect(inputs?.value?.platform).toBe(platform);
  });
});

describe("the brain call", () => {
  it("is made by every caller against the same workflow", () => {
    // Four workflows invoke Core-AI-Brain. Pointing one at a different id — or
    // at the placeholder an export can carry — leaves that channel unable to
    // answer, while every file still looks healthy in isolation. That is not
    // hypothetical: it is exactly what the Instagram and WhatsApp adapters
    // shipped with until TASK-14.
    for (const file of BRAIN_CALLERS) {
      const workflow = loadWorkflow(file);
      const workflowId = workflow.nodes.find((node) => node.name === "Execute Core AI Brain")?.parameters
        ?.workflowId as { value?: unknown } | undefined;

      expect(typeof workflowId?.value, `${file} has no brain workflow id`).toBe("string");
      expect(workflowId!.value, `${file} points at a placeholder brain id`).not.toMatch(/REPLACE|TODO|XXX/i);
    }

    const ids = new Set(
      BRAIN_CALLERS.map((file) => {
        const workflowId = loadWorkflow(file).nodes.find((node) => node.name === "Execute Core AI Brain")
          ?.parameters?.workflowId as { value?: unknown };
        return String(workflowId.value);
      })
    );

    expect(ids.size, `brain callers disagree: ${[...ids].join(", ")}`).toBe(1);
  });

  it("sends the same inputs from every channel adapter", () => {
    // The playground legitimately passes one extra field (`channel`), which the
    // brain falls back to `platform` without. The three Meta adapters have no
    // such reason to differ, so a key added to one alone is a mistake.
    const keySets = ADAPTERS.map(({ file }) => {
      const brain = loaded.get(file)!.nodes.find((node) => node.name === "Execute Core AI Brain");
      const inputs = brain?.parameters?.workflowInputs as { value?: Record<string, unknown> };

      return Object.keys(inputs?.value ?? {}).sort().join(",");
    });

    expect(new Set(keySets).size).toBe(1);

    // Every caller must name its platform: the brain files the conversation and
    // attributes the charge by it.
    for (const file of BRAIN_CALLERS) {
      const brain = loadWorkflow(file).nodes.find((node) => node.name === "Execute Core AI Brain");
      const inputs = brain?.parameters?.workflowInputs as { value?: Record<string, unknown> };

      expect(Object.keys(inputs?.value ?? {}), `${file} sends no platform`).toContain("platform");
    }
  });
});

describe("expressions reference nodes that exist", () => {
  const files = readdirSync(WORKFLOW_DIR).filter((file) => file.endsWith(".json") && !FRAGMENTS.has(file));

  /** `$('Node Name')` — how n8n reaches back to an earlier node's output. */
  const REFERENCE = new RegExp("\\$\\(['\"]([^'\"]+)['\"]\\)", "g");

  it.each(files)("%s", (file) => {
    // A renamed node leaves its old name in every expression that used it. n8n
    // accepts the file and fails at run time, on the one branch that reaches
    // that expression — so a channel can look fine for days and then break on
    // an image message. `Guard Active` names `Decrypt Integration Secrets` this
    // way, which is why the canonical definition cannot rename a node alone.
    const raw = readFileSync(join(WORKFLOW_DIR, file), "utf8");
    const names = new Set(loadWorkflow(file).nodes.map((node) => node.name));

    const dangling = [...new Set([...raw.matchAll(REFERENCE)].map((match) => match[1]))].filter(
      (referenced) => !names.has(referenced)
    );

    expect(dangling).toEqual([]);
  });
});
