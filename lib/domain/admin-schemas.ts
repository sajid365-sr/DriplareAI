import { z } from "zod";

export const PLAN_KEYS = ["starter", "growth", "business", "enterprise"] as const;
export const USER_ROLES = ["user", "admin", "super_admin"] as const;
export const PLATFORM_CATEGORIES = ["social", "messaging", "automation", "website"] as const;

export const adminUserUpdateSchema = z.object({
  plan: z.enum(PLAN_KEYS).optional(),
  role: z.enum(USER_ROLES).optional(),
  region: z.enum(["bd", "global"]).optional(),
  creditsBalance: z.number().int().min(0).optional(),
  includedCredits: z.number().int().min(0).optional(),
});

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;

export const platformCreateSchema = z.object({
  platformId: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores"),
  name: z.string().min(2).max(120),
  description: z.string().min(5).max(500),
  iconKey: z.string().min(2).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color"),
  isComingSoon: z.boolean().default(false),
  isActive: z.boolean().default(true),
  category: z.enum(PLATFORM_CATEGORIES).default("social"),
  order: z.number().int().min(0).default(0),
});

export const platformUpdateSchema = platformCreateSchema
  .omit({ platformId: true })
  .partial();

export type PlatformCreateInput = z.infer<typeof platformCreateSchema>;
export type PlatformUpdateInput = z.infer<typeof platformUpdateSchema>;

export const BLOG_STATUSES = ["draft", "published", "archived"] as const;
export const BLOG_LOCALES = ["en", "bn"] as const;

export const blogPostCreateSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  content: z.string().min(1),
  category: z.string().min(2).max(80).default("General"),
  tags: z.array(z.string().min(1).max(40)).max(10).default([]),
  locale: z.enum(BLOG_LOCALES).default("en"),
  status: z.enum(BLOG_STATUSES).default("draft"),
});

export const blogPostUpdateSchema = blogPostCreateSchema.partial();

export type BlogPostCreateInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;
