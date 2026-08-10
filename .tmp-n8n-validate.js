/* eslint-disable */
// Structural validator for the 5 generated n8n workflows.
const fs = require("fs");
const path = require("path");
const DIR = "c:/Users/User/Projects/DriplareAI/docs/n8n-JSON";

let problems = 0;
const fail = (wf, msg) => { problems++; console.log(`  ❌ [${wf}] ${msg}`); };
const ok = (msg) => console.log(`  ✅ ${msg}`);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const wf = file.replace(".json", "");
  console.log(`\n=== ${wf} ===`);
  const doc = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));

  // 1) unique node names + ids
  const names = doc.nodes.map((n) => n.name);
  const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
  if (dupNames.length) fail(wf, `duplicate node names: ${[...new Set(dupNames)].join(", ")}`);
  const ids = doc.nodes.map((n) => n.id);
  const dupIds = ids.filter((n, i) => ids.indexOf(n) !== i);
  if (dupIds.length) fail(wf, `duplicate node ids: ${[...new Set(dupIds)].join(", ")}`);

  const nameSet = new Set(names);

  // 2) connections: source + every target must exist
  for (const [srcName, conns] of Object.entries(doc.connections || {})) {
    if (!nameSet.has(srcName)) fail(wf, `connection source "${srcName}" is not a node`);
    for (const [type, outputs] of Object.entries(conns)) {
      outputs.forEach((slot, slotIdx) => {
        (slot || []).forEach((edge) => {
          if (!nameSet.has(edge.node)) fail(wf, `"${srcName}".${type}[${slotIdx}] → missing node "${edge.node}"`);
        });
      });
    }
  }

  // 3) every node except triggers/sticky should be reachable OR have outgoing (loose check: warn only)
  const hasOutgoing = new Set(Object.keys(doc.connections || {}));
  const hasIncoming = new Set();
  for (const conns of Object.values(doc.connections || {}))
    for (const outputs of Object.values(conns))
      for (const slot of outputs) for (const edge of slot || []) hasIncoming.add(edge.node);
  for (const n of doc.nodes) {
    if (n.type.includes("stickyNote")) continue;
    const isTrigger = n.type.includes("Trigger") || n.type.includes("webhook");
    if (!isTrigger && !hasIncoming.has(n.name) && !hasOutgoing.has(n.name))
      fail(wf, `orphan node (no in/out edges): "${n.name}"`);
    if (isTrigger && !hasOutgoing.has(n.name))
      fail(wf, `trigger "${n.name}" has no outgoing connection`);
  }

  // 4) credential-id consistency
  const CRED_IDS = { postgres: "3Aiu7UNMUMPB6aNu", openRouterApi: "jhNy5RPc2l0zAQry", googlePalmApi: "GSuBFeT3qsXKR0hv", firecrawlApi: "rbGOL6ScKjrEVLPs" };
  for (const n of doc.nodes) {
    if (!n.credentials) continue;
    for (const [ct, cv] of Object.entries(n.credentials)) {
      if (CRED_IDS[ct] && cv.id !== CRED_IDS[ct]) fail(wf, `node "${n.name}" cred ${ct} id=${cv.id} (expected ${CRED_IDS[ct]})`);
    }
  }

  // 5) template-literal leak: unresolved ${ } inside code/jsonBody would indicate a generator bug
  const raw = JSON.stringify(doc);
  const leak = raw.match(/\$\{[a-zA-Z_]/g);
  if (leak) fail(wf, `possible template-literal leak (\${...}) x${leak.length}`);

  ok(`${doc.nodes.length} nodes, ${Object.keys(doc.connections || {}).length} connection sources`);
}

// 6) Core Brain I/O contract + platform wiring
console.log(`\n=== CONTRACT ===`);
const core = JSON.parse(fs.readFileSync(path.join(DIR, "Core-AI-Brain.json"), "utf8"));
const trigger = core.nodes.find((n) => n.type === "n8n-nodes-base.executeWorkflowTrigger");
if (!trigger) fail("Core", "no executeWorkflowTrigger");
else if (trigger.parameters.inputSource !== "passthrough") fail("Core", `trigger inputSource=${trigger.parameters.inputSource} (expected passthrough)`);
else ok("Core trigger is passthrough");

const ret = core.nodes.find((n) => n.name === "Return to Platform");
const retFields = (ret?.parameters?.assignments?.assignments || []).map((a) => a.name);
for (const f of ["replyText", "galleryImages", "isOrderCreated"])
  if (!retFields.includes(f)) fail("Core", `Return to Platform missing output field "${f}"`);
if (retFields.length) ok(`Core outputs: ${retFields.join(", ")}`);

// AI sub-node wiring into the agent
const aiEdges = {};
for (const [src, conns] of Object.entries(core.connections)) {
  for (const type of Object.keys(conns)) if (type.startsWith("ai_")) {
    aiEdges[type] = aiEdges[type] || [];
    aiEdges[type].push(src);
  }
}
for (const need of ["ai_languageModel", "ai_memory", "ai_tool"])
  if (!aiEdges[need]) fail("Core", `no ${need} connection into agent`);
ok(`Core AI edges: ${Object.entries(aiEdges).map(([k, v]) => `${k}(${v.length})`).join(", ")}`);

// Platform handlers: must have Execute Core AI Brain + reference replyText
for (const h of ["Facebook-Integration", "WhatsApp-Integration", "Instagram-Integration"]) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, h + ".json"), "utf8"));
  const raw = JSON.stringify(d);
  const exec = d.nodes.find((n) => n.type === "n8n-nodes-base.executeWorkflow");
  if (!exec) fail(h, "no executeWorkflow caller node");
  else {
    if (exec.typeVersion !== 1.2) fail(h, `executeWorkflow typeVersion=${exec.typeVersion}`);
    if (!exec.parameters.workflowId || exec.parameters.workflowId.__rl !== true) fail(h, "workflowId is not a resource locator");
  }
  if (!raw.includes("Execute Core AI Brain').item.json.replyText")) fail(h, "does not consume replyText from Core Brain");
  // payload contract: Build Brain Payload emits the 7 contract fields
  const bp = d.nodes.find((n) => n.name === "Build Brain Payload");
  const bpFields = (bp?.parameters?.assignments?.assignments || []).map((a) => a.name).sort();
  const want = ["chatbotId", "customerInfo", "mediaType", "mediaUrl", "platform", "sessionId", "userMessage"];
  const missing = want.filter((w) => !bpFields.includes(w));
  if (missing.length) fail(h, `Build Brain Payload missing fields: ${missing.join(", ")}`);
  else ok(`${h}: caller + payload contract OK`);
}

console.log(`\n${problems === 0 ? "🎉 ALL STRUCTURAL CHECKS PASSED" : `⚠️  ${problems} problem(s) found`}`);
process.exit(problems === 0 ? 0 : 1);
