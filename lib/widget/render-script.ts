import { WIDGET_COPY } from "@/lib/domain/widget-copy";
import { buildWidgetApiPath, sanitizeBrandColor } from "@/lib/domain/widget-key";

/**
 * The embeddable widget, as a string.
 *
 * ## Why this is a string and not a component
 *
 * The widget runs on the merchant's own website — a page this project does not
 * build, does not control, and cannot assume anything about. It has no React,
 * no i18next, no Tailwind and no bundler. So the only thing that can be shipped
 * there is plain JavaScript that builds its own DOM.
 *
 * Writing it here, as a pure `input → string` function, keeps the awkward part
 * — embedding values safely into a script — in one testable place rather than
 * spread through a route handler.
 *
 * ## The three decisions that matter
 *
 * 1. **A shadow root.** The widget's CSS is written into a shadow root, so the
 *    merchant's stylesheet cannot restyle the chat bubbles and ours cannot
 *    restyle their page. This is not a nicety: without it, a site with a global
 *    `div { padding: 20px }` breaks the widget, and the merchant would blame us.
 *
 * 2. **`textContent`, never `innerHTML`.** Every string that reaches the DOM —
 *    the agent name, the welcome line, the visitor's own message, and above all
 *    the model's reply — is set as text. The reply is generated from whatever a
 *    stranger typed, so treating it as markup would hand every merchant's site a
 *    cross-site-scripting hole in the one place they trust us most. There is
 *    deliberately no `innerHTML` call anywhere in the generated script.
 *
 * 3. **No hardcoded colours in the markup.** The widget cannot see the app's
 *    `globals.css` — it is not on our origin. So it carries its own token set
 *    (`--drp-*`) defined once in the shadow root, with a dark-mode override, and
 *    every rule reads from those tokens. The single brand colour comes from the
 *    chatbot's own `avatarColor`, validated as a hex literal before it is
 *    written into CSS.
 */

export interface WidgetScriptInput {
  widgetKey: string;
  /** Origin the widget posts back to, e.g. `https://app.driplare.com`. */
  origin: string;
  /** The AI agent's name, shown in the header. */
  agentName: string;
  /** The agent's colour, `Chatbot.avatarColor`. */
  brandColor: string;
  /** A line under the agent name, or `null` for the translated default. */
  subtitle: string | null;
  /** The first bubble, or `null` for the translated default. */
  welcome: string | null;
  /** Which corner the launcher sits in. */
  position: "left" | "right";
}

/**
 * Injects a value into the script template as a JS literal.
 *
 * `JSON.stringify` already escapes quotes, backslashes and newlines, which is
 * what makes this safe. The extra `<` pass is belt-and-braces: it makes it
 * impossible for a value to close a `<script>` tag if the response is ever
 * inlined into HTML rather than fetched as a file, where `</script>` inside a
 * string would end the block early.
 */
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * A widget whose integration is missing, disconnected or not a website channel.
 *
 * It renders nothing at all — no bubble, no console noise, no error banner on
 * the merchant's page. That is the correct behaviour for the visitor, who has
 * no idea a widget was ever meant to be there: a broken chat bubble on a
 * storefront costs the merchant a customer, while a silent absence costs
 * nothing.
 *
 * The reason is logged server-side by the route instead, where the only person
 * who can act on it — the merchant — will find it.
 */
export function renderDisabledWidgetScript(reason: string): string {
  return [
    "/* Driplare widget: not served — " + reason.replace(/\*\//g, "*\\/") + " */",
    "/* Nothing is injected into the page. See the server log for the reason. */",
    "",
  ].join("\n");
}

export function renderWidgetScript(input: WidgetScriptInput): string {
  const brand = sanitizeBrandColor(input.brandColor);
  const position = input.position === "left" ? "left" : "right";

  const replacements: Record<string, string> = {
    __KEY__: embedJson(input.widgetKey),
    // Composed here rather than in the script body, so the endpoint the widget
    // posts to has exactly one definition — `buildWidgetApiPath()`. A literal
    // typed into the generated JS would drift from the route the first time one
    // of them moved, and the failure would be a widget that silently stops
    // replying.
    __API__: embedJson(`${input.origin.replace(/\/+$/, "")}${buildWidgetApiPath(input.widgetKey)}`),
    __BRAND__: embedJson(brand),
    __AGENT__: embedJson(input.agentName),
    __SUBTITLE__: embedJson(input.subtitle),
    __WELCOME__: embedJson(input.welcome),
    // Raw, not JSON-encoded: this one is substituted straight into CSS property
    // names (`left: 20px`), so it must arrive unquoted. `position` is narrowed
    // to exactly `"left"` or `"right"` above, which is what makes that safe.
    __POSITION__: position,
    __COPY__: embedJson(WIDGET_COPY),
  };

  return WIDGET_SCRIPT_TEMPLATE.replace(
    /__(?:KEY|API|BRAND|AGENT|SUBTITLE|WELCOME|POSITION|COPY)__/g,
    (token) => replacements[token] ?? "null"
  );
}

/**
 * The script itself.
 *
 * Written as a placeholder template rather than a JS template literal so the
 * body can use backticks and `${…}` freely without escaping — the generated
 * code is ordinary JavaScript, and it reads better when it can be written as
 * such.
 *
 * ⚠️ `__TOKEN__` names must stay in sync with the `replacements` map above; the
 *    regex there lists them explicitly, so a typo surfaces as a literal
 *    `__TOKEN__` in the served file rather than as a silent `undefined`.
 */
const WIDGET_SCRIPT_TEMPLATE = `(function () {
  "use strict";

  // Embedding twice — a tag duplicated by a CMS, or a theme that renders the
  // footer twice — must not stack two launchers on top of each other.
  if (window.__driplareWidgetLoaded) return;
  window.__driplareWidgetLoaded = true;

  var KEY = __KEY__;
  var API = __API__;
  var BRAND = __BRAND__;
  var AGENT = __AGENT__;
  var SUBTITLE = __SUBTITLE__;
  var WELCOME = __WELCOME__;
  var COPY = __COPY__;

  var STORE_KEY = "driplare.widget.session." + KEY;
  var MAX_LENGTH = 2000;

  /**
   * The visitor's language.
   *
   * Mirrors pickWidgetLanguage() in lib/domain/widget-copy.ts — the same
   * "starts with bn" rule, because the two must agree: the widget picks the
   * copy it renders, and the server picks the language a refusal is written in.
   */
  function detectLanguage() {
    var tag = (navigator.language || navigator.userLanguage || "en").toLowerCase();
    return tag.indexOf("bn") === 0 ? "bn" : "en";
  }
  var LANGUAGE = detectLanguage();
  var TEXT = COPY[LANGUAGE] || COPY.en;

  /**
   * One conversation id per visitor, kept in localStorage so a reload does not
   * throw away the history the visitor can still see on screen.
   *
   * Mirrored in memory as well: localStorage throws in some privacy modes, and
   * without the memory copy every message would mint a new session and the
   * conversation would fragment mid-sentence.
   */
  var sessionInMemory = null;
  function getSessionId() {
    if (sessionInMemory) return sessionInMemory;
    var id = null;
    try { id = window.localStorage.getItem(STORE_KEY); } catch (e) { id = null; }
    if (!id) {
      id = "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { window.localStorage.setItem(STORE_KEY, id); } catch (e) { /* memory copy carries it */ }
    }
    sessionInMemory = id;
    return id;
  }

  // ── Shadow DOM ────────────────────────────────────────────────────────────
  // Everything below lives inside this root, so the host page's CSS and ours
  // cannot reach each other.
  var host = document.createElement("div");
  host.setAttribute("data-driplare-widget", KEY);
  var root = host.attachShadow({ mode: "open" });

  var style = document.createElement("style");
  style.textContent = [
    ":host {",
    "  --drp-brand: " + BRAND + ";",
    "  --drp-brand-soft: color-mix(in srgb, " + BRAND + " 22%, white);",
    "  --drp-surface: #ffffff;",
    "  --drp-surface-sunken: #f4f4f5;",
    "  --drp-text: #18181b;",
    "  --drp-text-muted: #71717a;",
    "  --drp-border: rgba(0, 0, 0, 0.10);",
    "  --drp-shadow: 0 16px 40px rgba(0, 0, 0, 0.20);",
    "  --drp-radius: 16px;",
    "}",
    // The visitor's own device decides, not the merchant's site: a merchant on
    // a light theme still gets a readable widget for a visitor whose OS is dark.
    "@media (prefers-color-scheme: dark) {",
    "  :host {",
    "    --drp-surface: #18181b;",
    "    --drp-surface-sunken: #27272a;",
    "    --drp-text: #fafafa;",
    "    --drp-text-muted: #a1a1aa;",
    "    --drp-border: rgba(255, 255, 255, 0.12);",
    "    --drp-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);",
    "  }",
    "}",
    "* { box-sizing: border-box; }",
    ".drp-launcher {",
    "  position: fixed; bottom: 20px; __POSITION__: 20px;",
    "  width: 60px; height: 60px; border-radius: 50%; border: 0; padding: 0;",
    "  background: linear-gradient(135deg, var(--drp-brand), var(--drp-brand-soft));",
    "  color: #ffffff; cursor: pointer; z-index: 2147483000;",
    "  display: flex; align-items: center; justify-content: center;",
    "  box-shadow: var(--drp-shadow);",
    "  transition: transform 160ms ease, box-shadow 160ms ease;",
    "}",
    ".drp-launcher:hover { transform: scale(1.06); }",
    ".drp-launcher:focus-visible { outline: 3px solid var(--drp-brand-soft); outline-offset: 3px; }",
    ".drp-launcher svg { width: 26px; height: 26px; }",
    ".drp-panel {",
    "  position: fixed; bottom: 92px; __POSITION__: 20px;",
    "  width: 380px; max-width: calc(100vw - 40px);",
    "  height: 560px; max-height: calc(100vh - 132px);",
    "  background: var(--drp-surface); color: var(--drp-text);",
    "  border-radius: var(--drp-radius); box-shadow: var(--drp-shadow);",
    "  border: 1px solid var(--drp-border);",
    "  display: flex; flex-direction: column; overflow: hidden;",
    "  z-index: 2147483000;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Bengali', sans-serif;",
    "  font-size: 14px; line-height: 1.5;",
    "  animation: drp-in 180ms ease-out;",
    "}",
    ".drp-panel[hidden] { display: none; }",
    "@keyframes drp-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }",
    "@media (prefers-reduced-motion: reduce) {",
    "  .drp-panel { animation: none; }",
    "  .drp-launcher { transition: none; }",
    "}",
    ".drp-head {",
    "  background: linear-gradient(135deg, var(--drp-brand), var(--drp-brand-soft));",
    "  color: #ffffff; padding: 16px 18px;",
    "  display: flex; align-items: center; gap: 12px;",
    "}",
    ".drp-avatar {",
    "  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;",
    "  background: rgba(255, 255, 255, 0.22);",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-weight: 600; font-size: 16px; text-transform: uppercase;",
    "}",
    ".drp-head-text { flex: 1; min-width: 0; }",
    ".drp-name { font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".drp-sub { font-size: 12px; opacity: 0.85; }",
    ".drp-close {",
    "  background: transparent; border: 0; color: #ffffff; cursor: pointer;",
    "  padding: 6px; border-radius: 8px; line-height: 0; opacity: 0.9;",
    "}",
    ".drp-close:hover { opacity: 1; background: rgba(255, 255, 255, 0.16); }",
    ".drp-log {",
    "  flex: 1; overflow-y: auto; padding: 16px;",
    "  display: flex; flex-direction: column; gap: 10px;",
    "  background: var(--drp-surface);",
    "}",
    ".drp-row { display: flex; }",
    ".drp-row.drp-mine { justify-content: flex-end; }",
    ".drp-bubble {",
    "  max-width: 82%; padding: 10px 13px; border-radius: 14px;",
    "  white-space: pre-wrap; overflow-wrap: anywhere;",
    "}",
    ".drp-them .drp-bubble { background: var(--drp-surface-sunken); border-bottom-left-radius: 4px; }",
    ".drp-mine .drp-bubble {",
    "  background: linear-gradient(135deg, var(--drp-brand), var(--drp-brand-soft));",
    "  color: #ffffff; border-bottom-right-radius: 4px;",
    "}",
    ".drp-dots { display: flex; gap: 4px; align-items: center; height: 18px; }",
    ".drp-dots span {",
    "  width: 6px; height: 6px; border-radius: 50%; background: var(--drp-text-muted);",
    "  animation: drp-blink 1.2s infinite ease-in-out;",
    "}",
    ".drp-dots span:nth-child(2) { animation-delay: 0.15s; }",
    ".drp-dots span:nth-child(3) { animation-delay: 0.3s; }",
    "@keyframes drp-blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }",
    ".drp-form {",
    "  display: flex; align-items: flex-end; gap: 8px; padding: 12px;",
    "  border-top: 1px solid var(--drp-border); background: var(--drp-surface);",
    "}",
    ".drp-input {",
    "  flex: 1; resize: none; border: 1px solid var(--drp-border);",
    "  background: var(--drp-surface-sunken); color: var(--drp-text);",
    "  border-radius: 12px; padding: 10px 12px; font: inherit;",
    "  max-height: 120px; min-height: 42px;",
    "}",
    ".drp-input:focus { outline: 2px solid var(--drp-brand); outline-offset: -1px; }",
    ".drp-send {",
    "  flex-shrink: 0; width: 42px; height: 42px; border-radius: 12px; border: 0;",
    "  background: linear-gradient(135deg, var(--drp-brand), var(--drp-brand-soft));",
    "  color: #ffffff; cursor: pointer; line-height: 0;",
    "  display: flex; align-items: center; justify-content: center;",
    "}",
    ".drp-send:disabled { opacity: 0.45; cursor: not-allowed; }",
    ".drp-send svg { width: 18px; height: 18px; }",
    ".drp-foot {",
    "  padding: 0 12px 10px; text-align: center; font-size: 11px;",
    "  color: var(--drp-text-muted); background: var(--drp-surface);",
    "}",
    // Phone widths: a 380px panel with a 20px gutter does not fit, so the panel
    // takes the width it can and pins to the bottom.
    "@media (max-width: 480px) {",
    "  .drp-panel {",
    "    __POSITION__: 12px; left: 12px; right: 12px; width: auto;",
    "    bottom: 88px; height: auto; max-height: calc(100vh - 116px);",
    "  }",
    "  .drp-launcher { bottom: 16px; __POSITION__: 16px; }",
    "}",
  ].join("\\n");
  root.appendChild(style);

  var panel = document.createElement("div");
  panel.className = "drp-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", AGENT);
  panel.hidden = true;

  var head = document.createElement("div");
  head.className = "drp-head";

  var avatar = document.createElement("div");
  avatar.className = "drp-avatar";
  avatar.textContent = (AGENT || "?").trim().charAt(0) || "?";

  var headText = document.createElement("div");
  headText.className = "drp-head-text";

  var name = document.createElement("div");
  name.className = "drp-name";
  name.textContent = AGENT;

  var sub = document.createElement("div");
  sub.className = "drp-sub";
  sub.textContent = SUBTITLE || TEXT.subtitle;

  var closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "drp-close";
  closeButton.setAttribute("aria-label", TEXT.close);
  closeButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="18" height="18"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  headText.appendChild(name);
  headText.appendChild(sub);
  head.appendChild(avatar);
  head.appendChild(headText);
  head.appendChild(closeButton);

  var log = document.createElement("div");
  log.className = "drp-log";
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");

  var form = document.createElement("form");
  form.className = "drp-form";

  var textarea = document.createElement("textarea");
  textarea.className = "drp-input";
  textarea.rows = 1;
  textarea.maxLength = MAX_LENGTH;
  textarea.placeholder = TEXT.placeholder;
  textarea.setAttribute("aria-label", TEXT.placeholder);

  var sendButton = document.createElement("button");
  sendButton.type = "submit";
  sendButton.className = "drp-send";
  sendButton.setAttribute("aria-label", TEXT.send);
  sendButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.99.99 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z"/></svg>';

  form.appendChild(textarea);
  form.appendChild(sendButton);

  var foot = document.createElement("div");
  foot.className = "drp-foot";
  foot.textContent = TEXT.poweredBy;

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(form);
  panel.appendChild(foot);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "drp-launcher";
  launcher.setAttribute("aria-label", TEXT.launcherLabel);
  launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';

  root.appendChild(panel);
  root.appendChild(launcher);

  // ── Rendering ─────────────────────────────────────────────────────────────
  // Every value below is written with textContent. The model's reply is derived
  // from a stranger's input, so it is data, never markup — see the module note.
  function addRow(text, mine) {
    var row = document.createElement("div");
    row.className = "drp-row " + (mine ? "drp-mine" : "drp-them");

    var bubble = document.createElement("div");
    bubble.className = "drp-bubble";
    bubble.textContent = text;

    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function addTyping() {
    var row = document.createElement("div");
    row.className = "drp-row drp-them";

    var bubble = document.createElement("div");
    bubble.className = "drp-bubble";

    var dots = document.createElement("div");
    dots.className = "drp-dots";
    dots.setAttribute("aria-label", TEXT.typing);
    for (var i = 0; i < 3; i += 1) dots.appendChild(document.createElement("span"));

    bubble.appendChild(dots);
    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
    return row;
  }

  function setBusy(busy) {
    sendButton.disabled = busy;
    textarea.readOnly = busy;
  }

  var busy = false;
  function send(message) {
    if (busy || !message) return;
    busy = true;
    setBusy(true);

    addRow(message, true);
    var typingRow = addTyping();

    window
      .fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message, sessionId: getSessionId(), lang: LANGUAGE }),
      })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        typingRow.remove();
        var reply = result.data && typeof result.data.reply === "string" ? result.data.reply : "";
        addRow(reply || TEXT.error, false);
      })
      .catch(function () {
        // The network failed, or the API answered with something that is not
        // JSON. Either way the visitor gets a sentence, not a spinner forever.
        typingRow.remove();
        addRow(TEXT.error, false);
      })
      .then(function () {
        busy = false;
        setBusy(false);
      });
  }

  function open() {
    panel.hidden = false;
    launcher.style.display = "none";
    if (!log.childElementCount) addRow(WELCOME || TEXT.welcome, false);
    try { textarea.focus(); } catch (e) { /* focus is best-effort */ }
  }

  function close() {
    panel.hidden = true;
    launcher.style.display = "";
  }

  launcher.addEventListener("click", open);
  closeButton.addEventListener("click", close);

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var message = textarea.value.trim();
    if (!message) return;
    textarea.value = "";
    textarea.style.height = "auto";
    send(message);
  });

  // Enter sends, Shift+Enter starts a new line — the convention every other
  // chat box on the merchant's site will have taught the visitor already.
  textarea.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else send(textarea.value.trim());
    }
  });

  // Grow with the text, up to the CSS max-height.
  textarea.addEventListener("input", function () {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !panel.hidden) close();
  });

  var mount = function () { document.body.appendChild(host); };
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
`;
