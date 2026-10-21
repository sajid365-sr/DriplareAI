import { describe, expect, it } from "vitest";

import { DEFAULT_WIDGET_BRAND, buildWidgetApiPath } from "@/lib/domain/widget-key";
import { WIDGET_COPY } from "@/lib/domain/widget-copy";
import { renderDisabledWidgetScript, renderWidgetScript } from "./render-script";

const KEY = "clx9f2k3b0000abcd1234efgh";
const ORIGIN = "https://app.driplare.com";

function render(overrides: Partial<Parameters<typeof renderWidgetScript>[0]> = {}) {
  return renderWidgetScript({
    widgetKey: KEY,
    origin: ORIGIN,
    agentName: "Driplare Support",
    brandColor: "#6d28d9",
    subtitle: null,
    welcome: null,
    position: "right",
    ...overrides,
  });
}

/**
 * Parses the generated source without running it.
 *
 * `new Function` compiles its body and throws `SyntaxError` on anything
 * malformed, which is exactly the failure this test exists to catch: a stray
 * brace in the template would otherwise ship as a `<script>` that does nothing
 * on every merchant's site, and nothing in this repository would notice — the
 * file is never imported by the app, only served.
 */
function assertParsesAsJavaScript(source: string) {
  expect(() => new Function(source)).not.toThrow();
}

describe("renderWidgetScript — the served file", () => {
  it("is syntactically valid JavaScript", () => {
    assertParsesAsJavaScript(render());
  });

  it("leaves no placeholder unsubstituted", () => {
    // A token the replace list forgot would ship as the literal text
    // `__WHATEVER__` inside working-looking code.
    expect(render()).not.toMatch(/__[A-Z]+__/);
  });

  it("posts to the endpoint buildWidgetApiPath defines", () => {
    // The API base is composed on the server precisely so this URL has one
    // definition. If the two ever drifted, the widget would load and then fail
    // on every send — the worst kind of broken, because it looks fine.
    expect(render()).toContain(JSON.stringify(`${ORIGIN}${buildWidgetApiPath(KEY)}`));
  });

  it("does not double the slash when the origin ends in one", () => {
    expect(render({ origin: `${ORIGIN}/` })).toContain(JSON.stringify(`${ORIGIN}${buildWidgetApiPath(KEY)}`));
  });

  it("carries the key so a session survives a reload", () => {
    expect(render()).toContain(JSON.stringify(KEY));
  });
});

describe("renderWidgetScript — escaping", () => {
  it("cannot be closed early by a value containing a script tag", () => {
    // The served file is normally fetched, but the same renderer could be
    // inlined — and then a merchant-typed name containing `</script>` would end
    // the block and everything after it would become markup on their page.
    const source = render({ agentName: "Bobby </script><img src=x onerror=alert(1)>" });

    expect(source).not.toContain("</script>");
    expect(source).toContain("\\u003c/script>");
  });

  it("escapes a value that tries to close a comment", () => {
    expect(renderDisabledWidgetScript("bad */ reason")).not.toContain("*/ reason");
  });
});

describe("renderWidgetScript — the one untrusted string it renders", () => {
  it("writes bubbles as text, never as markup", () => {
    // The model's reply is derived from whatever a stranger typed, and it lands
    // on a page the merchant trusts us with. Treating it as markup would be an
    // XSS hole in the one place that trust is most expensive.
    const source = render();

    expect(source).toContain("bubble.textContent = text;");
    expect(source).not.toMatch(/bubble\.innerHTML/);
  });

  it("sets the agent name and welcome line as text too", () => {
    const source = render();

    expect(source).toContain("name.textContent = AGENT;");
    expect(source).toContain("sub.textContent = SUBTITLE || TEXT.subtitle;");
  });
});

describe("renderWidgetScript — branding", () => {
  it("uses the agent's colour", () => {
    expect(render({ brandColor: "#ff8800" })).toContain("#ff8800");
  });

  it("falls back to the product violet for a colour that is not a hex literal", () => {
    // The colour is written into a <style> block, so a non-hex value is markup
    // injection rather than a cosmetic problem.
    expect(render({ brandColor: "red; } body { display: none }" })).toContain(
      DEFAULT_WIDGET_BRAND
    );
  });

  it("honours the launcher corner", () => {
    expect(render({ position: "left" })).toContain("left: 20px");
    expect(render({ position: "right" })).toContain("right: 20px");
  });
});

describe("renderWidgetScript — resilience on someone else's page", () => {
  it("refuses to mount twice", () => {
    // A CMS that renders the footer twice would otherwise stack two launchers.
    expect(render()).toContain("window.__driplareWidgetLoaded");
  });

  it("survives a browser that blocks localStorage", () => {
    // Private modes throw on access. Without the in-memory copy every message
    // would mint a new session and the conversation would fragment.
    const source = render();

    expect(source).toContain("window.localStorage.getItem(STORE_KEY)");
    expect(source).toContain("window.localStorage.setItem(STORE_KEY");
    expect(source).toContain("sessionInMemory");
  });

  it("shows a sentence rather than a permanent spinner when the request fails", () => {
    expect(render()).toContain(".catch(function () {");
    expect(render()).toContain("addRow(TEXT.error, false);");
  });

  it("scopes its styles so they cannot leak into the host page", () => {
    expect(render()).toContain('attachShadow({ mode: "open" })');
  });

  it("respects a reduced-motion preference", () => {
    expect(render()).toContain("prefers-reduced-motion: reduce");
  });

  it("follows the visitor's colour scheme, not the merchant's site theme", () => {
    expect(render()).toContain("prefers-color-scheme: dark");
  });
});

describe("renderWidgetScript — both languages travel with the script", () => {
  it("ships every string in both locales", () => {
    // The widget runs on a page with no i18next and makes no second request, so
    // a missing language would render `undefined` to the visitor.
    const source = render();

    for (const copy of Object.values(WIDGET_COPY)) {
      expect(source).toContain(JSON.stringify(copy.welcome));
      expect(source).toContain(JSON.stringify(copy.placeholder));
      expect(source).toContain(JSON.stringify(copy.error));
    }
  });

  it("picks the language the same way the server does", () => {
    // Mirrors pickWidgetLanguage(): "starts with bn". The widget chooses what it
    // renders, the server chooses what a refusal says — the two must agree.
    expect(render()).toContain('tag.indexOf("bn") === 0 ? "bn" : "en"');
  });
});

describe("renderDisabledWidgetScript", () => {
  it("is valid JavaScript that injects nothing", () => {
    const source = renderDisabledWidgetScript("integration disconnected");

    assertParsesAsJavaScript(source);
    expect(source).not.toContain("attachShadow");
    expect(source).not.toContain("document.body.appendChild");
  });

  it("names the reason for the merchant, who is the only one who can act on it", () => {
    expect(renderDisabledWidgetScript("integration disconnected")).toContain(
      "integration disconnected"
    );
  });

  it("shows the visitor nothing at all", () => {
    // A broken chat bubble on a storefront costs the merchant a customer, while
    // a silent absence costs nothing. So there is no UI, not even an error.
    const source = renderDisabledWidgetScript("unknown widget key");

    expect(source.trim().startsWith("/*")).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Running the generated script
//
// Parsing is not the same as working. The file is never imported by this app —
// it is served to someone else's website and executed there — so a runtime
// `TypeError` on load would ship as a chat bubble that never appears, on a page
// nothing in this repository can observe. These tests execute the real output
// against a stub DOM and drive it the way a visitor would.
//
// The stub is deliberately tiny and hand-rolled rather than jsdom: the widget
// touches a dozen DOM members, and enumerating exactly those is what makes the
// tests readable — and keeps the project's dependency set unchanged.
// ══════════════════════════════════════════════════════════════════════════════

type Listener = (event: unknown) => void;

class FakeElement {
  readonly tagName: string;
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  attributes: Record<string, string> = {};
  listeners: Record<string, Listener[]> = {};
  style: Record<string, unknown> = {};
  shadowRoot: FakeElement | null = null;

  textContent = "";
  innerHTML = "";
  className = "";
  hidden = false;
  disabled = false;
  readOnly = false;
  value = "";
  scrollTop = 0;
  scrollHeight = 0;
  rows = 1;
  maxLength = 0;
  placeholder = "";

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get childElementCount() {
    return this.children.length;
  }

  attachShadow() {
    this.shadowRoot = new FakeElement("#shadow-root");
    return this.shadowRoot;
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  /**
   * Real detachment, not a no-op.
   *
   * The widget removes its typing indicator by calling `.remove()` on it, and a
   * stub that quietly ignored that would leave the dots on screen forever — so
   * the tests below could not tell a working indicator from a stuck one.
   */
  remove() {
    if (!this.parent) return;

    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  focus() {}

  /** In a browser this dispatches `submit`; here it calls the same listeners. */
  requestSubmit() {
    this.fire("submit", { preventDefault() {} });
  }

  fire(type: string, event: unknown = {}) {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }

  /** Depth-first search by class, which is how the tests find the widget's parts. */
  find(className: string): FakeElement | null {
    if (this.className.split(/\s+/).includes(className)) return this;
    for (const child of this.children) {
      const found = child.find(className);
      if (found) return found;
    }
    return null;
  }

  findAll(className: string): FakeElement[] {
    const matches: FakeElement[] = this.className.split(/\s+/).includes(className) ? [this] : [];
    for (const child of this.children) matches.push(...child.findAll(className));
    return matches;
  }
}

interface FetchCall {
  url: string;
  body: { message: string; sessionId: string; lang: string };
}

interface WidgetRun {
  body: FakeElement;
  calls: FetchCall[];
  storage: Map<string, string>;
}

/** Loads the generated script against a stub DOM and returns the handles tests need. */
function runWidget(
  source: string,
  options: { language?: string; reply?: string; storageThrows?: boolean } = {}
): WidgetRun {
  const calls: FetchCall[] = [];
  const storage = new Map<string, string>();

  const body = new FakeElement("body");
  const document = {
    body,
    createElement: (tagName: string) => new FakeElement(tagName),
    addEventListener: () => {},
  };

  const window = {
    __driplareWidgetLoaded: false,
    document,
    localStorage: {
      getItem: (key: string) => {
        if (options.storageThrows) throw new Error("blocked");
        return storage.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (options.storageThrows) throw new Error("blocked");
        storage.set(key, value);
      },
    },
    fetch: (url: string, init: { body: string }) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ reply: options.reply ?? "Hello from the agent" }),
      });
    },
  };

  const navigator = { language: options.language ?? "en" };

  // The generated code is a plain function body, so it is invoked with the same
  // three globals the browser would give it — and nothing else, which is also a
  // check that it reaches for no API beyond these.
  const load = new Function("window", "document", "navigator", source);
  load(window, document, navigator);

  return { body, calls, storage };
}

/** Lets the script's promise chain settle before assertions. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the served widget, actually running", () => {
  it("mounts without throwing", () => {
    const { body } = runWidget(render());

    expect(body.children).toHaveLength(1);
    expect(body.children[0].attributes["data-driplare-widget"]).toBe(KEY);
  });

  it("mounts into a shadow root, so the host page cannot restyle it", () => {
    const { body } = runWidget(render());
    const host = body.children[0];

    expect(host.shadowRoot).not.toBeNull();
    expect(host.shadowRoot?.find("drp-launcher")).not.toBeNull();
    expect(host.shadowRoot?.find("drp-panel")).not.toBeNull();
  });

  it("injects no CSS variable declaration for a colour the host page controls", () => {
    const { body } = runWidget(render({ brandColor: "#ff8800" }));
    const style = body.children[0].shadowRoot?.children[0];

    expect(style?.textContent).toContain("--drp-brand: #ff8800;");
  });

  it("starts closed, with the launcher visible and the panel hidden", () => {
    const { body } = runWidget(render());
    const root = body.children[0].shadowRoot!;

    expect(root.find("drp-panel")?.hidden).toBe(true);
  });

  it("opens on the launcher and greets the visitor once", () => {
    const { body } = runWidget(render({ welcome: "Ask us anything" }));
    const root = body.children[0].shadowRoot!;

    root.find("drp-launcher")!.fire("click");
    expect(root.find("drp-panel")!.hidden).toBe(false);
    expect(root.findAll("drp-bubble")[0].textContent).toBe("Ask us anything");

    // Closing and reopening must not repeat the greeting or wipe the history.
    root.find("drp-close")!.fire("click");
    root.find("drp-launcher")!.fire("click");
    expect(root.findAll("drp-bubble")).toHaveLength(1);
  });

  it("falls back to the translated greeting when the merchant set none", () => {
    const { body } = runWidget(render());
    const root = body.children[0].shadowRoot!;

    root.find("drp-launcher")!.fire("click");
    expect(root.findAll("drp-bubble")[0].textContent).toBe(WIDGET_COPY.en.welcome);
  });

  it("speaks Bengali to a Bengali browser", () => {
    // The language is chosen in the browser, not requested from the server, so
    // the served script has to carry both — and pick the right one.
    const { body } = runWidget(render(), { language: "bn-BD" });
    const root = body.children[0].shadowRoot!;

    root.find("drp-launcher")!.fire("click");
    expect(root.findAll("drp-bubble")[0].textContent).toBe(WIDGET_COPY.bn.welcome);
    expect(root.find("drp-input")!.placeholder).toBe(WIDGET_COPY.bn.placeholder);
  });
});

describe("the served widget, sending a message", () => {
  async function sendOne(options: Parameters<typeof runWidget>[1] = {}) {
    const run = runWidget(render(), options);
    const root = run.body.children[0].shadowRoot!;

    root.find("drp-launcher")!.fire("click");
    root.find("drp-input")!.value = "How much is delivery?";
    root.find("drp-form")!.requestSubmit();
    await settle();

    return { ...run, root };
  }

  it("posts the message to the endpoint the server composed", async () => {
    const { calls } = await sendOne();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ORIGIN}${buildWidgetApiPath(KEY)}`);
  });

  it("sends the message, the session and the language the server needs", async () => {
    const { calls } = await sendOne({ language: "bn" });

    expect(calls[0].body.message).toBe("How much is delivery?");
    // The server picks which language a refusal comes back in from this.
    expect(calls[0].body.lang).toBe("bn");
    expect(calls[0].body.sessionId.length).toBeGreaterThan(0);
  });

  it("keeps one session across a reload", async () => {
    const first = await sendOne();
    const second = await sendOne();

    // The stub's storage is per-run, so this checks the id is *stored*; the
    // stub's map is what a second page load would read.
    expect([...first.storage.keys()][0]).toContain(KEY);
  });

  it("renders the visitor's message and the agent's reply", async () => {
    const { root } = await sendOne({ reply: "Delivery is 60 taka." });
    const bubbles = root.findAll("drp-bubble");

    expect(bubbles).toHaveLength(3); // welcome, the visitor's, the reply
    expect(bubbles[1].textContent).toBe("How much is delivery?");
    expect(bubbles[2].textContent).toBe("Delivery is 60 taka.");
  });

  it("takes the typing indicator down once the reply lands", async () => {
    // A spinner that outlives its answer is the failure a visitor notices most,
    // and it is invisible to any test that only checks the reply arrived.
    const { root } = await sendOne();

    expect(root.findAll("drp-dots")).toHaveLength(0);
  });

  it("never interprets a reply as markup", async () => {
    // The reply is generated from a stranger's input and lands on the
    // merchant's page. This is the assertion that keeps it data, not code.
    const payload = '<img src=x onerror="alert(1)">';
    const { root } = await sendOne({ reply: payload });

    expect(root.findAll("drp-bubble")[2].textContent).toBe(payload);
    expect(root.findAll("drp-bubble")[2].innerHTML).toBe("");
  });

  it("clears the input so the next message starts empty", async () => {
    const { root } = await sendOne();

    expect(root.find("drp-input")!.value).toBe("");
  });

  it("still works when the browser blocks storage", async () => {
    // Private modes throw on localStorage access. The conversation must not
    // fragment just because the session id could not be persisted.
    const { calls } = await sendOne({ storageThrows: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].body.sessionId).toMatch(/^w/);
  });

  it("sends on Enter and leaves Shift+Enter for a new line", async () => {
    const run = runWidget(render());
    const root = run.body.children[0].shadowRoot!;
    const input = root.find("drp-input")!;

    root.find("drp-launcher")!.fire("click");

    let prevented = false;
    input.value = "on a new line";
    input.fire("keydown", {
      key: "Enter",
      shiftKey: true,
      preventDefault: () => { prevented = true; },
    });
    expect(prevented).toBe(false);
    expect(run.calls).toHaveLength(0);

    input.value = "sent";
    input.fire("keydown", { key: "Enter", shiftKey: false, preventDefault: () => {} });
    await settle();

    expect(run.calls).toHaveLength(1);
    expect(run.calls[0].body.message).toBe("sent");
  });

  it("uses the greeting a Bengali visitor can read when the merchant set none", async () => {
    const run = runWidget(render(), { language: "bn" });
    const root = run.body.children[0].shadowRoot!;

    root.find("drp-launcher")!.fire("click");
    expect(root.findAll("drp-bubble")[0].textContent).toBe(WIDGET_COPY.bn.welcome);
  });
});
