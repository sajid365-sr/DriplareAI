import { describe, expect, it } from "vitest";

import { WIDGET_COPY, pickWidgetLanguage, type WidgetCopy } from "./widget-copy";

/**
 * Words a *visitor* must never read.
 *
 * The same rule `lib/ai/quota-answer.test.ts` enforces on the refusal sentence,
 * applied to the widget's own chrome. The person reading these strings is a
 * shopper standing on the merchant's website; that the merchant is out of
 * credits, behind on a plan or in arrears is the merchant's business and
 * telling the shopper costs them a sale.
 */
const BILLING_VOCABULARY =
  /credit|balance|billing|invoice|subscribe|subscription|plan|top ?up|recharge|pay|ক্রেডিট|ব্যালেন্স|রিচার্জ|বিল|সাবস্ক্রিপশন|টাকা/i;

const LANGUAGES = Object.keys(WIDGET_COPY) as Array<keyof typeof WIDGET_COPY>;

describe("WIDGET_COPY", () => {
  it("covers exactly the two languages the product ships", () => {
    expect(LANGUAGES.sort()).toEqual(["bn", "en"]);
  });

  it("has no missing key in either language", () => {
    // Both locales are embedded in the same served script, so a key present in
    // one and absent in the other renders `undefined` to a real visitor — on a
    // page where nothing can report it.
    const [en, ...rest] = LANGUAGES.map((language) => Object.keys(WIDGET_COPY[language]).sort());

    for (const keys of rest) {
      expect(keys).toEqual(en);
    }
  });

  it.each(LANGUAGES)("has no empty string in %s", (language) => {
    for (const [key, value] of Object.entries(WIDGET_COPY[language])) {
      expect(value.trim(), `${language}.${key}`).not.toBe("");
    }
  });

  it.each(LANGUAGES)("tells the %s reader nothing about the merchant's billing", (language) => {
    for (const [key, value] of Object.entries(WIDGET_COPY[language])) {
      expect(value, `${language}.${key}`).not.toMatch(BILLING_VOCABULARY);
    }
  });

  it("keeps technical terms in English in the Bengali copy", () => {
    // AGENTS.md §4: words like "AI Agent" stay English rather than being
    // transliterated, because that is how they are written in the market.
    expect(WIDGET_COPY.bn.subtitle).toContain("AI assistant");
  });

  it("names Driplare in both languages rather than translating the brand", () => {
    expect(WIDGET_COPY.en.poweredBy).toContain("Driplare");
    expect(WIDGET_COPY.bn.poweredBy).toContain("Driplare");
  });

  it("is assignable to the declared shape", () => {
    // Compile-time guard, kept as a value so the intent survives in the test
    // list: a renamed key would fail here as well as in `tsc`.
    const copy: WidgetCopy = WIDGET_COPY.en;
    expect(copy.launcherLabel.length).toBeGreaterThan(0);
  });
});

describe("pickWidgetLanguage", () => {
  it.each([
    ["bn", "bn"],
    ["bn-BD", "bn"],
    ["bn-IN", "bn"],
    ["BN-bd", "bn"],
    ["  bn  ", "bn"],
  ])("reads %p as Bengali", (input, expected) => {
    expect(pickWidgetLanguage(input)).toBe(expected);
  });

  it.each(["en", "en-US", "fr", "ar-EG", "", "  "])(
    "falls back to English for %p",
    (input) => {
      // Falling back to English is the safer failure: the copy is at least
      // readable to a visitor whose language we could not identify.
      expect(pickWidgetLanguage(input)).toBe("en");
    }
  );

  it.each([undefined, null, 42, {}, []])(
    "falls back to English for the non-string %p",
    (input) => {
      // The value arrives from a public request body, so it is whatever the
      // caller sent — not necessarily a string.
      expect(pickWidgetLanguage(input)).toBe("en");
    }
  );
});
