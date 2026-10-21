import { describe, expect, it } from "vitest";

import { AIError, isAIError, toAIError, type AIErrorCode } from "./ai-error";

describe("AIError", () => {
  it.each([
    ["not_configured", 503],
    ["quota_exceeded", 402],
    ["workspace_suspended", 403],
    ["provider_out_of_credit", 503],
    ["rate_limited", 429],
    ["all_models_failed", 502],
  ] satisfies Array<[AIErrorCode, number]>)("maps %s to HTTP %i", (code, status) => {
    expect(new AIError(code, "boom").status).toBe(status);
  });

  it("treats only platform-level failures as operational", () => {
    // A merchant running out of credits is a normal event. The platform's own
    // OpenRouter balance running out is an outage — only that should page a human.
    expect(new AIError("provider_out_of_credit", "x").isOperational).toBe(true);
    expect(new AIError("not_configured", "x").isOperational).toBe(true);

    expect(new AIError("quota_exceeded", "x").isOperational).toBe(false);
    expect(new AIError("workspace_suspended", "x").isOperational).toBe(false);
    expect(new AIError("rate_limited", "x").isOperational).toBe(false);
    expect(new AIError("all_models_failed", "x").isOperational).toBe(false);
  });

  it("carries the diagnostic detail needed to reproduce an incident", () => {
    const error = new AIError("all_models_failed", "boom", {
      task: "chat",
      model: "openai/gpt-4o-mini",
      tried: ["google/gemini-2.5-flash", "openai/gpt-4o-mini"],
      attempts: 2,
    });

    expect(error.details.tried).toEqual(["google/gemini-2.5-flash", "openai/gpt-4o-mini"]);
    expect(error.details.attempts).toBe(2);
  });

  it("is a real Error so it keeps a stack trace", () => {
    const error = new AIError("all_models_failed", "boom");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AIError");
  });
});

describe("isAIError", () => {
  it("recognises its own error", () => {
    expect(isAIError(new AIError("rate_limited", "x"))).toBe(true);
  });

  it("recognises an error that crossed a module boundary", () => {
    // Simulates the same error arriving through a second copy of this module
    // (Next.js gives route handlers their own bundle), where `instanceof`
    // would fail because the class objects are not identical.
    const foreign = { isAIError: true, code: "quota_exceeded", message: "x" };

    expect(isAIError(foreign)).toBe(true);
  });

  it.each([
    [new Error("plain")],
    [null],
    [undefined],
    ["AIError"],
    [{}],
    [{ isAIError: "yes", code: "quota_exceeded" }],
    [{ isAIError: true }],
  ])("rejects %p", (value) => {
    expect(isAIError(value)).toBe(false);
  });
});

describe("toAIError", () => {
  it("passes an existing AIError through untouched", () => {
    const original = new AIError("rate_limited", "x");

    expect(toAIError(original)).toBe(original);
  });

  it("wraps an unknown throw so callers only ever handle one type", () => {
    const wrapped = toAIError(new Error("socket hang up"));

    expect(wrapped.code).toBe("all_models_failed");
    expect(wrapped.message).toBe("socket hang up");
  });

  it("survives a thrown non-Error", () => {
    expect(toAIError("just a string").message).toBe("Unknown AI failure");
    expect(toAIError(undefined).message).toBe("Unknown AI failure");
  });

  it("lets the caller choose the fallback code", () => {
    expect(toAIError(new Error("x"), "not_configured").code).toBe("not_configured");
  });
});
