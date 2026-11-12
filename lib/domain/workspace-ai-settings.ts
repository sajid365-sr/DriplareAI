import { z } from "zod";

export const WorkspaceAIRulesSchema = z.object({
  brandVoice: z.string().trim().max(2_000).default(""),
  languagePolicy: z.string().trim().max(2_000).default(""),
  customerAddress: z.string().trim().max(1_000).default(""),
  universalPolicies: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
  boundaries: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
  customRules: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    instruction: z.string().trim().max(4_000),
  }).strict()).max(20).default([]),
}).strict();

export const WorkspaceAISettingsPayloadSchema = z.object({
  corePrompt: z.string().trim().max(4_000),
  rules: WorkspaceAIRulesSchema,
}).strict();

export type WorkspaceAIRules = z.infer<typeof WorkspaceAIRulesSchema>;
export type WorkspaceAISettingsPayload = z.infer<typeof WorkspaceAISettingsPayloadSchema>;

export const EMPTY_WORKSPACE_AI_RULES: WorkspaceAIRules = {
  brandVoice: "",
  languagePolicy: "",
  customerAddress: "",
  universalPolicies: [],
  boundaries: [],
  customRules: [],
};

export function parseWorkspaceAIRules(value: unknown): WorkspaceAIRules {
  // A workspace without an AI settings row has no saved rules yet.
  if (value === null || value === undefined) {
    return WorkspaceAIRulesSchema.parse({});
  }

  const parsed = WorkspaceAIRulesSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const knownKeys = new Set(Object.keys(EMPTY_WORKSPACE_AI_RULES));
    if (!Object.keys(record).some((key) => knownKeys.has(key))) {
      const legacyRules = Object.entries(record).flatMap(([key, rawValue]) => {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        return values.flatMap((entry) => {
          if (typeof entry !== "string" && typeof entry !== "number" && typeof entry !== "boolean") return [];
          const content = String(entry).trim();
          return content ? [`${key}: ${content}`] : [];
        });
      });
      if (legacyRules.length <= 20 && legacyRules.every((rule) => rule.length <= 1_000)) {
        return { ...EMPTY_WORKSPACE_AI_RULES, universalPolicies: legacyRules };
      }
    }
  }

  throw parsed.error;
}

export function formatWorkspaceAIRules(
  corePrompt: string,
  rules: WorkspaceAIRules
): string {
  const sections: string[] = [];

  if (rules.brandVoice) sections.push(`Brand voice and etiquette:\n${rules.brandVoice}`);
  if (rules.languagePolicy) sections.push(`Language policy:\n${rules.languagePolicy}`);
  if (rules.customerAddress) sections.push(`Customer address style:\n${rules.customerAddress}`);
  if (rules.universalPolicies.length > 0) {
    sections.push(`Universal business policies:\n${rules.universalPolicies.map((rule) => `- ${rule}`).join("\n")}`);
  }
  if (rules.boundaries.length > 0) {
    sections.push(`Boundaries and prohibited claims:\n${rules.boundaries.map((rule) => `- ${rule}`).join("\n")}`);
  }
  for (const rule of rules.customRules) {
    if (rule.instruction) sections.push(`${rule.label}:\n${rule.instruction}`);
  }
  if (corePrompt) sections.push(`Additional company instructions:\n${corePrompt}`);

  return sections.join("\n\n");
}
