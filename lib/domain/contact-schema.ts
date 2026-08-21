import { z } from "zod";

export const contactSubmissionSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional(),
  message: z.string().min(5).max(5000),
  source: z.enum(["website", "demo", "contact_page"]).default("website"),
});

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;

export const contactStatusSchema = z.enum(["new", "read", "replied", "archived"]);

export const updateContactStatusSchema = z.object({
  status: contactStatusSchema,
});
