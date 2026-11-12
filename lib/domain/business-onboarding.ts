import { z } from "zod";
import { WORKSPACE_BUSINESS_CATEGORY_IDS } from "@/lib/domain/workspace-business-categories";

export const BUSINESS_ONBOARDING_STORAGE_KEY = "driplare_business_onboarding";

const categorySchema = z.enum(WORKSPACE_BUSINESS_CATEGORY_IDS);
const logoSchema = z.string().max(200_000).nullable();

export const businessOnboardingDraftSchema = z.object({
  requestId: z.string().uuid().or(z.literal("")),
  name: z.string().max(100),
  category: categorySchema.or(z.literal("")),
  customBusinessTitle: z.string().max(60),
  logoUrl: logoSchema,
});

export const businessOnboardingSchema = businessOnboardingDraftSchema.extend({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  category: categorySchema,
});

export type BusinessOnboardingDraft = z.infer<typeof businessOnboardingDraftSchema>;
export type BusinessOnboardingData = z.infer<typeof businessOnboardingSchema>;
