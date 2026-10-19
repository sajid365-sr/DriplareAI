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
  "Fetch Integration Secrets",
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
    expect(names).toContain("Fetch Integration Secrets");
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

/**
 * Secrets reach n8n from the app, not from a decryption node.
 *
 * The adapters used to decrypt `Integration.config` themselves in a Code node.
 * That cannot run on a hosted Community instance: the JS task runner blocks
 * `require('crypto')` by default, and a Code node can never read an n8n
 * credential, so there was no way to give it the key either. The node became an
 * HTTP Request to `/api/internal/integration-secrets`, authenticated with the
 * same `x-n8n-secret` header credential the other `/api/internal/*` calls use.
 *
 * These assertions exist because the old shape is the tempting one: pasting a
 * decrypt block back into a Code node "fixes" a local test and breaks every
 * hosted deployment, silently, on the first real customer message.
 */
describe("integration secrets", () => {
  it.each(ADAPTERS)("$file fetches them from the app", ({ file }) => {
    const workflow = loadWorkflow(file);
    const node = workflow.nodes.find((entry) => entry.name === "Fetch Integration Secrets");

    expect(node?.type, `${file} does not call the app`).toBe("n8n-nodes-base.httpRequest");
    expect(node?.parameters?.authentication).toBe("genericCredentialType");
    expect(node?.parameters?.genericAuthType).toBe("httpHeaderAuth");
    expect(String(node?.parameters?.url)).toContain("/api/internal/integration-secrets");

    // The call must name the row it wants. Without this it posts an empty body
    // and the route answers 400 — which reads in n8n as "the app is down".
    expect(String(node?.parameters?.jsonBody)).toContain("integrationId");

    // Force JSON parsing. This was learned the hard way: a deployment that did
    // not yet contain the route answered with Next's HTML not-found page, and
    // the node accepted it as a successful response. `Guard Active` then read
    // `connected: undefined`, took the false branch, and the workflow stopped
    // without a single red node — the customer's message was simply never
    // answered. Asking for JSON turns that into a failed execution instead.
    const options = node?.parameters?.options as
      | { response?: { response?: { responseFormat?: unknown } } }
      | undefined;
    expect(options?.response?.response?.responseFormat).toBe("json");

    // The SQL step immediately before it is the only supplier of that id.
    const query = String(
      workflow.nodes.find((entry) => entry.name === "Fetch Integration")?.parameters?.query ?? ""
    );
    expect(query).toContain('"integrationId"');

    // The encrypted material is no longer read here at all; the app's response
    // replaces the item, so selecting ciphertext would only copy useless bytes
    // into the execution record.
    expect(JSON.stringify(workflow)).not.toContain("require('crypto')");
    expect(JSON.stringify(workflow)).not.toContain("INTEGRATION_ENCRYPTION_KEY");
  });
});

/**
 * The media path must survive any single step failing.
 *
 * Almost every way media can break is external — a download that times out, a
 * MIME type Gemini refuses, a Cloudinary outage.
 * n8n does not treat any of those as an error unless a node says so — an
 * unhandled failure ends the execution, and the customer who sent the photo
 * simply never gets an answer.
 *
 * These are the nodes TASK-26 added or hardened. Every one of them must stay
 * present, keep routing its failure to `Media Failed`, and stay between
 * `Media Router` and `Merge Media`, because `Merge Media` is the only node that
 * knows which branch actually ran.
 */
const MEDIA_STEPS = [
  "Download Image",
  "Download Image (Auth)",
  "Code in JavaScript",
  "Gemini Vision",
  "Download Audio",
  "Download Audio (Auth)",
  "Normalize Audio Type",
  "Gemini Transcribe",
  "Upload Image to Cloudinary",
  "Merge Image Upload",
  "Upload Audio to Cloudinary",
  "Merge Audio Upload",
];

/** Edges whose absence would silently skip a media step. */
const MEDIA_EDGES: Array<[string, string]> = [
  ["Code in JavaScript", "Upload Image to Cloudinary"],
  ["Upload Image to Cloudinary", "Merge Image Upload"],
  ["Merge Image Upload", "Gemini Vision"],
  ["Gemini Vision", "Set Image Message"],
  ["Normalize Audio Type", "Upload Audio to Cloudinary"],
  ["Upload Audio to Cloudinary", "Merge Audio Upload"],
  ["Merge Audio Upload", "Audio Supported?"],
  ["Audio Supported?", "Gemini Transcribe"],
  ["Audio Supported?", "Set Audio Message"],
  ["Gemini Transcribe", "Set Audio Message"],
  ["Set Image Message", "Merge Media"],
  ["Set Audio Message", "Merge Media"],
  ["Media Failed", "Merge Media"],
  ["Merge Media", "Embed Query"],
];

describe("the media path in the brain", () => {
  const brain = loadWorkflow("Core-AI-Brain.json");
  const names = new Set(brain.nodes.map((node) => node.name));

  type MainConnections = Record<string, { main?: Array<Array<{ node?: string }>> }>;
  const connections = (brain.connections ?? {}) as MainConnections;
  const targetOf = (from: string, output: number) =>
    connections[from]?.main?.[output]?.[0]?.node ?? null;

  it("still has every media step", () => {
    // Deleting one of these does not fail a workflow — it retypes the message
    // and moves on, so the loss shows up as "photos stopped being understood"
    // with no error anywhere in n8n.
    expect(MEDIA_STEPS.filter((name) => !names.has(name))).toEqual([]);
  });

  it.each(MEDIA_STEPS)("%s sends its failures to Media Failed", (name) => {
    const node = brain.nodes.find((entry) => entry.name === name);

    // `continueErrorOutput` is what gives the node a second output at all;
    // without it the first output's failure kills the execution and the second
    // one is never created.
    expect(node?.onError).toBe("continueErrorOutput");
    expect(connections[name]?.main?.length, `${name} has no error output`).toBe(2);
    expect(targetOf(name, 1), `${name}'s error output goes nowhere`).toBe("Media Failed");
  });

  it("keeps the branch order that the router depends on", () => {
    for (const [from, to] of MEDIA_EDGES) {
      const reachable = (connections[from]?.main ?? []).some((slot) =>
        slot?.some((link) => link.node === to)
      );

      expect(reachable, `${from} no longer reaches ${to}`).toBe(true);
    }

    // Media Router's outputs are positional: 0 = no media, 1 = image, 2 = audio.
    // Reordering them would send an image down the audio path and vice versa,
    // which reads as "the bot misunderstands every attachment".
    expect(targetOf("Media Router", 0)).toBe("Text Message");
    expect(targetOf("Media Router", 1)).toBe("Image Auth?");
    expect(targetOf("Media Router", 2)).toBe("Audio Auth?");
  });

  it("authenticates the Cloudinary upload with a credential, not an env var", () => {
    // The upload started life as a Code node reading `$env`. That quietly
    // required the hosting provider to define four variables — and a Code node
    // can never read an n8n credential, so the fix had to be an HTTP Request
    // node with Basic Auth (Cloudinary's Upload API accepts api_key:api_secret
    // this way and needs no signature).
    for (const name of ["Upload Image to Cloudinary", "Upload Audio to Cloudinary"]) {
      const node = brain.nodes.find((entry) => entry.name === name);

      expect(node?.type, `${name} is not an HTTP Request`).toBe("n8n-nodes-base.httpRequest");
      expect(node?.parameters?.authentication).toBe("genericCredentialType");
      expect(node?.parameters?.genericAuthType).toBe("httpBasicAuth");
    }

    // A reintroduced `$env` lookup would fail on every hosted/community
    // instance that cannot define environment variables.
    expect(JSON.stringify(brain)).not.toContain("$env.CLOUDINARY");
    expect(names.has("Cloudinary Config")).toBe(true);
  });

  it("passes the media auth header from every caller", () => {
    // WhatsApp sends only a media id, so the adapter resolves a short-lived URL
    // and hands the brain the token to fetch it. A caller that forgets the key
    // sends `undefined`, and the authenticated download goes out with an empty
    // Authorization header — a 400 that looks like a broken attachment.
    for (const file of BRAIN_CALLERS) {
      const brainNode = loadWorkflow(file).nodes.find((node) => node.name === "Execute Core AI Brain");
      const inputs = brainNode?.parameters?.workflowInputs as { value?: Record<string, unknown> };

      expect(Object.keys(inputs?.value ?? {}), `${file} sends no mediaAuthHeader`).toContain(
        "mediaAuthHeader"
      );
    }
  });
});

describe("the inbound media adapters", () => {
  it("never reports media without the id needed to fetch it", () => {
    const workflow = loadWorkflow("WhatsApp-Integration.json");
    const normalizer = workflow.nodes.find((node) => node.name === "Normalize WhatsApp Payload");
    const code = String(normalizer?.parameters?.jsCode ?? "");

    // WhatsApp's webhook carries no URL, only an id. Setting `mediaType` without
    // `mediaId` makes the brain try to download an empty string, which fails
    // into `Media Failed` on every single photo. The order matters too: the id
    // has to be read in the same branch that declares the media type.
    expect(code).toMatch(/mediaType = 'image';[\s\S]*?mediaId = [^;]*msg\.image\.id/);
    expect(code).toMatch(/mediaType = 'audio';[\s\S]*?mediaId = [^;]*msg\.audio\.id/);
    expect(code).toContain("if (!userMessage && !mediaId) return [];");
  });

  it.each(["Facebook-Integration.json", "Instagram-Integration.json"])(
    "%s stores one row per outbound message and only pauses AI for a human reply",
    (file) => {
      // Two separate duplicate bugs live in this node, and both were invisible
      // in the inbox until a customer looked closely:
      //
      //   1. A reply sent from the Live Inbox is written by the API route; the
      //      echo webhook then wrote it again.
      //   2. A reply sent by the AI is written by Core AI Brain; Meta echoes
      //      that too. The old guard only looked for `sentByHuman = true`, so
      //      the AI's own echo became a second row labelled "Human Agent" —
      //      and, worse, the UPDATE below it paused the AI.
      //
      // So the query must (a) recognise an AI-authored row, and (b) run the
      // pause/lastMessage update only when a row was actually inserted. Without
      // (b), merely skipping the insert still pauses the AI on its own echo.
      const workflow = loadWorkflow(file);
      const echo = workflow.nodes.find((node) => node.name === "Log Echo Message");
      const query = String(echo?.parameters?.query ?? "");

      expect(query).toContain("WHERE NOT EXISTS");
      expect(query).toContain("\"sentByHuman\" = true");
      expect(query).toContain("\"sentByHuman\" = false");
      expect(query).toContain("WITH inserted AS (");
      expect(query).toContain("AND EXISTS (SELECT 1 FROM inserted)");
    }
  );
});

/**
 * Typing indicators and product cards.
 *
 * Two channel capabilities that are easy to fake and easy to forget:
 *
 *   • Messenger's typing indicator expires after roughly twenty seconds, so a
 *     single `typing_on` call is not enough for a slow brain. Facebook keeps a
 *     background sub-workflow refreshing it, and that workflow must remain async
 *     (`waitForSubWorkflow: false`) or it would delay the reply it announces.
 *   • WhatsApp has no session carousel and Instagram has no typing indicator.
 *     Both facts are asserted so a future "fix" cannot quietly invent an API
 *     call that the platforms will reject.
 *
 * The card path is a contract between three files: the brain parses and strips
 * `[CARDS]`, the adapters turn `productCards` into channel payloads, and the
 * normalizers turn an Order tap into the marker the AI understands.
 */
describe("typing indicators and product cards", () => {
  type Params = Record<string, unknown>;
  type MainConnections = Record<string, { main?: Array<Array<{ node?: string }>> }>;

  const workflowOf = (file: string) => loadWorkflow(file);
  const paramsOf = (workflow: WorkflowFile, name: string): Params =>
    (workflow.nodes.find((entry) => entry.name === name)?.parameters ?? {}) as Params;
  const targetsOf = (workflow: WorkflowFile, from: string, output: number): string[] => {
    const connections = (workflow.connections ?? {}) as MainConnections;
    return (connections[from]?.main?.[output] ?? []).map((link) => String(link.node));
  };

  const facebook = workflowOf("Facebook-Integration.json");
  const instagram = workflowOf("Instagram-Integration.json");
  const whatsapp = workflowOf("WhatsApp-Integration.json");
  const brain = workflowOf("Core-AI-Brain.json");

  it("shows seen, then typing, then refreshes typing from an async sub-workflow", () => {
    // A person opens the chat before typing: mark_seen → short pause → typing_on.
    // Skipping the pause is what made the dots appear before the blue tick.
    expect(String(paramsOf(facebook, "Mark Seen").jsonBody)).toContain("mark_seen");
    expect(targetsOf(facebook, "Upsert Chat Session", 0)).toEqual(["Mark Seen"]);
    expect(targetsOf(facebook, "Mark Seen", 0)).toEqual(["Wait 2s"]);
    expect(targetsOf(facebook, "Wait 2s", 0)).toEqual(["Typing On"]);

    expect(String(paramsOf(facebook, "Typing On").jsonBody)).toContain("typing_on");
    expect(targetsOf(facebook, "Typing On", 0)).toEqual(["Start Typing Keepalive"]);
    expect(targetsOf(facebook, "Start Typing Keepalive", 0)).toEqual(["Execute Core AI Brain"]);

    const keepalive = paramsOf(facebook, "Start Typing Keepalive");
    const options = (keepalive.options ?? {}) as Params;

    // Async is the whole point: a blocking sub-workflow would add its entire
    // refresh loop to the reply latency.
    expect(options.waitForSubWorkflow).toBe(false);

    const keepaliveWorkflow = workflowOf("Typing-Keepalive.json");
    expect(targetsOf(keepaliveWorkflow, "Continue?", 0)).toEqual(["Send Typing"]);
    expect(targetsOf(keepaliveWorkflow, "Send Typing", 0)).toEqual(["Wait 7s"]);
  });

  it("uses WhatsApp's official typing indicator and passes the inbound message id", () => {
    const body = String(paramsOf(whatsapp, "Typing On").jsonBody);

    expect(body).toContain("typing_indicator");
    expect(body).toContain("message_id");
    expect(paramsOf(whatsapp, "Typing On").options).toBeDefined();

    // Blue tick first, typing dots after — same shape as Messenger.
    expect(String(paramsOf(whatsapp, "Mark Read").jsonBody)).toContain('"read"');
    expect(targetsOf(whatsapp, "Upsert Chat Session", 0)).toEqual(["Mark Read"]);
    expect(targetsOf(whatsapp, "Mark Read", 0)).toEqual(["Wait 2s"]);
    expect(targetsOf(whatsapp, "Wait 2s", 0)).toEqual(["Typing On"]);

    // The indicator is tied to the customer's message id; without it the API
    // has nothing to attach the dots to.
    expect(String(paramsOf(whatsapp, "Normalize WhatsApp Payload").jsCode)).toContain(
      "messageId: msg.id"
    );
  });

  it("does not pretend Instagram has a typing indicator", () => {
    // Instagram Messaging API exposes no typing indicator. A node here would
    // either fail on every message or need a fake endpoint.
    expect(instagram.nodes.some((entry) => entry.name === "Typing On")).toBe(false);
    expect(instagram.nodes.some((entry) => entry.name === "Start Typing Keepalive")).toBe(false);
  });

  it("parses, sanitises and strips the card marker in the brain", () => {
    const agentOptions = (paramsOf(brain, "AI Agent").options ?? {}) as Params;
    const systemMessage = String(agentOptions.systemMessage ?? "");

    expect(systemMessage).toContain("[CARDS]");
    expect(systemMessage).toContain("[ORDER_CARD:");
    // A named product must not drag the rest of the lookup results along.
    expect(systemMessage).toContain("include only that product");
    // A browse request must not become a wall of text: the cards carry the
    // products, so the visible reply is one short line and nothing else.
    expect(systemMessage).toContain("NEVER list product names, prices, stock or descriptions");
    // The Order button has to collect quantity too — Create Order rejects a
    // line without it, and the old prompt only asked for name/phone/address.
    expect(systemMessage).toContain("quantity -> full name -> phone number");

    const format = String(paramsOf(brain, "Format Response").jsCode);
    expect(format).toContain("carouselIds");
    expect(format).toContain("[CARDS]");
    // A model that ignores the marker must not leave the customer with a
    // promise of photos and no card.
    expect(format).toContain("wantsCardsSql");
    // A browse request the model could not map to ids still gets cards: a
    // bare [CARDS] marker asks the SQL for the catalogue.
    expect(format).toContain("[\\t]*([^\\n\\r]+)?");
    expect(format).toContain("cardMatch !== null");

    const fetchCards = paramsOf(brain, "Fetch Product Cards");
    expect(String(fetchCards.query)).toContain("json_agg");
    expect(String(fetchCards.query)).toContain("wantsCardsSql");
    // The deterministic fallback must not dump the whole catalogue when the
    // customer named a product. Only name matches are returned unless no
    // catalogue name appears in the message at all.
    expect(String(fetchCards.query)).toContain("NOT EXISTS");
    expect(String(fetchCards.query)).toContain("userMessageSql");
    // A card request is still required: a plain product question must not
    // turn into a carousel just because the product name was mentioned.
    expect(String(fetchCards.query)).toContain("<> ''");
    // Duplicate catalogue names collapse to one card, and only real http(s)
    // image URLs reach Meta/WhatsApp (markdown-mangled or empty URLs are dead
    // on arrival and can fail the whole carousel send).
    expect(String(fetchCards.query)).toContain("DISTINCT ON");
    expect(String(fetchCards.query)).toContain("~* '^https?://'");
    // Details button: the card payload must carry the original post link, or
    // the customer only ever sees the one image the template can hold.
    expect(String(fetchCards.query)).toContain("'postUrl'");
    expect(targetsOf(brain, "Format Response", 0)).toEqual(["Fetch Product Cards"]);

    const assignments = ((paramsOf(brain, "Return to Platform").assignments ?? {}) as Params)
      .assignments as Array<{ name?: string }>;
    expect(assignments.map((entry) => entry.name)).toContain("productCards");

    // The merchant should read the product title, not the machine marker.
    expect(String(paramsOf(brain, "Merge Media").jsCode)).toContain("[ORDER_CARD:");
  });

  it("persists product cards on the assistant message for the Live Inbox", () => {
    // The inbox renders mediaType = 'carousel' from the JSON stored in
    // mediaUrl. No new row and no new column: the assistant message that is
    // already written carries the cards, exactly once.
    const save = String(paramsOf(brain, "Save Chat History").query);
    expect(save).toContain('"mediaUrl"');
    expect(save).toContain("'carousel'");
    expect(save).toContain("Fetch Product Cards");
    expect(save).toContain("String.fromCharCode(39)");
  });

  for (const [file, buildName, sendName] of [
    ["Facebook-Integration.json", "Build Facebook Carousel", "Send Facebook Carousel"],
    ["Instagram-Integration.json", "Build Instagram Carousel", "Send Instagram Carousel"],
  ] as const) {
    it(`${file} sends a generic-template carousel`, () => {
      const workflow = workflowOf(file);
      const buildCode = String(paramsOf(workflow, buildName).jsCode);

      expect(targetsOf(workflow, "Has Product Cards?", 0)).toContain(buildName);
      expect(targetsOf(workflow, buildName, 0)).toEqual([sendName]);
      expect(JSON.stringify(paramsOf(workflow, buildName))).toContain("generic");
      expect(JSON.stringify(paramsOf(workflow, sendName))).toContain("carouselBody");
      // The Order postback stays the first button. A product with a public
      // post URL gets a second, web_url button that opens the original post.
      expect(buildCode).toContain("web_url");
      expect(buildCode).toContain("postUrl");
      expect(buildCode).toContain("ORDER:");
    });
  }

  it("uses a list plus images on WhatsApp, where session carousels do not exist", () => {
    const code = String(paramsOf(whatsapp, "Build WhatsApp Cards").jsCode);

    expect(code).toContain("'list'");
    expect(code).toContain("ORDER:");
    expect(code).toContain("type: 'image'");
    expect(targetsOf(whatsapp, "Has Product Cards?", 0)).toContain("Build WhatsApp Cards");
    expect(targetsOf(whatsapp, "Build WhatsApp Cards", 0)).toEqual([
      "Send WhatsApp Product Cards",
    ]);
  });

  it("turns card buttons and postbacks into the AI's order marker", () => {
    expect(String(paramsOf(facebook, "Normalize FB Payload").jsCode)).toContain("messaging.postback");
    expect(String(paramsOf(facebook, "Normalize FB Payload").jsCode)).toContain("[ORDER_CARD:");
    // A postback without the ORDER: prefix must not vanish silently.
    expect(String(paramsOf(facebook, "Normalize FB Payload").jsCode)).toContain(
      "Any other button tap"
    );

    expect(String(paramsOf(instagram, "Normalize Instagram Payload").jsCode)).toContain(
      "messaging.postback"
    );
    expect(String(paramsOf(instagram, "Normalize Instagram Payload").jsCode)).toContain(
      "[ORDER_CARD:"
    );
    expect(String(paramsOf(instagram, "Normalize Instagram Payload").jsCode)).toContain(
      "Any other button tap"
    );

    const waNormalizer = String(paramsOf(whatsapp, "Normalize WhatsApp Payload").jsCode);
    expect(waNormalizer).toContain("list_reply");
    expect(waNormalizer).toContain("[ORDER_CARD:");
  });
});

/**
 * The agent's tool schemas.
 *
 * Before the agent runs, n8n collects every connected tool's parameters into one
 * schema and rejects the whole node if a `$fromAI()` key appears twice with a
 * different description or type. Nothing in the editor warns about this: the
 * workflow saves, then every single message dies at the AI Agent with
 * "Duplicate key 'product_name' found with different description or type".
 *
 * That is exactly how it broke in production. `Product Lookup` searched name and
 * description with "the product name or keyword..." but matched the id with
 * "the product name or productId...", and n8n 2.32 refused to build the tool at
 * all. The fix is one description covering all three, and this guard is what
 * keeps a future edit from reintroducing a second variant.
 */
describe("agent tool schemas", () => {
  const brain = loadWorkflow("Core-AI-Brain.json");
  const FROM_AI =
    /\$fromAI\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;

  it("declares every $fromAI key with one description and type", () => {
    const variants = new Map<string, Set<string>>();

    for (const node of brain.nodes) {
      const source = JSON.stringify(node.parameters ?? {});
      for (const [, key, description, type] of source.matchAll(FROM_AI)) {
        const seen = variants.get(key) ?? new Set<string>();
        seen.add(`${type}::${description}`);
        variants.set(key, seen);
      }
    }

    const conflicts = [...variants]
      .filter(([, seen]) => seen.size > 1)
      .map(([key, seen]) => `${key} -> ${[...seen].join(" | ")}`);

    expect(conflicts).toEqual([]);
  });

  it("keeps the agent's system prompt a valid expression", () => {
    // A literal newline inside a quoted string is invalid expression syntax.
    // One slipped in as `\n` instead of `\\n` in the JSON escape, and n8n
    // painted the entire system message with "[ERROR: invalid syntax]".
    const agent = brain.nodes.find((node) => node.name === "AI Agent");
    const options = (agent?.parameters?.options ?? {}) as Record<string, unknown>;
    const system = String(options.systemMessage ?? "");

    expect(system.startsWith("=")).toBe(true);

    const expression = system
      .slice(1)
      .replace(/^\{\{/, "")
      .replace(/\}\}$/, "")
      .trim();

    expect(expression).not.toMatch(/[\r\n]/);
    // Compiles the expression without running it: `$` and `$json` are the two
    // globals n8n injects, and nothing else is needed to catch a syntax error.
    expect(() => new Function("$", "$json", `return (${expression});`)).not.toThrow();
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
