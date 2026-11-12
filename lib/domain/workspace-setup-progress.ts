export const WORKSPACE_SETUP_STEP_KEYS = [
  "business",
  "agent",
  "channel",
  "test",
  "live",
] as const;

export type WorkspaceSetupStepKey = (typeof WORKSPACE_SETUP_STEP_KEYS)[number];
export type WorkspaceSetupReadiness = Record<WorkspaceSetupStepKey, boolean>;

export function getWorkspaceSetupSteps(readiness: WorkspaceSetupReadiness) {
  return WORKSPACE_SETUP_STEP_KEYS.map((key) => ({
    key,
    complete: readiness[key],
  }));
}
