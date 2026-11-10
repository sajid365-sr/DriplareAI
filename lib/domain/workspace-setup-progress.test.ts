import { describe, expect, it } from "vitest";
import { getWorkspaceSetupSteps, type WorkspaceSetupReadiness } from "./workspace-setup-progress";

describe("workspace setup progress", () => {
  it("returns the five setup steps in merchant journey order", () => {
    const steps = getWorkspaceSetupSteps({
      business: false,
      agent: false,
      channel: false,
      test: false,
      live: false,
    });

    expect(steps.map((step) => step.key)).toEqual(["business", "agent", "channel", "test", "live"]);
    expect(steps.every((step) => !step.complete)).toBe(true);
  });

  it("derives completion counts only from saved readiness", () => {
    const readiness: WorkspaceSetupReadiness = {
      business: true,
      agent: true,
      channel: false,
      test: false,
      live: false,
    };
    const steps = getWorkspaceSetupSteps(readiness);

    expect(steps.filter((step) => step.complete)).toHaveLength(2);
  });

  it("allows a completed setup to retain completed state across all steps", () => {
    const steps = getWorkspaceSetupSteps({
      business: true,
      agent: true,
      channel: true,
      test: true,
      live: true,
    });

    expect(steps.every((step) => step.complete)).toBe(true);
  });
});
