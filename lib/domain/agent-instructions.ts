import { z } from "zod";

export const AGENT_ROLE_OPTIONS = ["social_sales", "order_support", "reception_booking", "campaign", "customer_support", "custom"] as const;

export const AgentInstructionsSchema = z.object({
  role: z.enum(AGENT_ROLE_OPTIONS),
  purpose: z.string().trim().max(1200).default(""),
  responsibilities: z.string().trim().max(2000).default(""),
  tone: z.string().trim().max(800).default(""),
  handoff: z.string().trim().max(1000).default(""),
  boundaries: z.string().trim().max(1600).default(""),
  allowedFormSlugs: z.array(z.string().trim().min(1).max(100)).max(50).transform((slugs) => Array.from(new Set(slugs))),
});

export type AgentInstructions = z.infer<typeof AgentInstructionsSchema>;

export const EMPTY_AGENT_INSTRUCTIONS: AgentInstructions = {
  role: "customer_support",
  purpose: "",
  responsibilities: "",
  tone: "",
  handoff: "",
  boundaries: "",
  allowedFormSlugs: [],
};

export function parseAgentInstructions(value: unknown): AgentInstructions {
  const parsed = AgentInstructionsSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_AGENT_INSTRUCTIONS;
}

export function formatAgentInstructions(role: string | null, value: unknown): string {
  const parsed = parseAgentInstructions(value);
  const roleName = (role || parsed.role).replaceAll("_", " ");
  const lines = [
    `Role: ${roleName}`,
    parsed.purpose && `Purpose: ${parsed.purpose}`,
    parsed.responsibilities && `Responsibilities:\n${parsed.responsibilities}`,
    parsed.tone && `Response style:\n${parsed.tone}`,
    parsed.handoff && `Human handoff:\n${parsed.handoff}`,
    parsed.boundaries && `Agent boundaries:\n${parsed.boundaries}`,
    parsed.allowedFormSlugs.length
      ? `Authorized business forms: ${parsed.allowedFormSlugs.join(", ")}. Do not collect or submit a record through any other form.`
      : "No custom business forms are authorized for this Agent. Do not create a custom form record.",
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n\n");
}
