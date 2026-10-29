import { z } from "zod";

export const CustomFieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "phone",
  "select",
  "boolean",
]);

export type CustomFieldType = z.infer<typeof CustomFieldTypeSchema>;

export const CustomFieldDefinitionSchema = z.object({
  key: z
    .string()
    .min(1, "Field key is required")
    .regex(/^[a-z0-9_]+$/, "Field key must contain only lowercase letters, numbers, and underscores"),
  label: z.string().min(1, "Field label is required"),
  labelBn: z.string().optional(),
  type: CustomFieldTypeSchema.default("text"),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
});

export type CustomFieldDefinition = z.infer<typeof CustomFieldDefinitionSchema>;

export const CreateCustomTableSchemaDto = z.object({
  name: z.string().min(1, "Schema name is required"),
  slug: z
    .string()
    .min(1, "Schema slug is required")
    .regex(/^[a-z0-9_]+$/, "Slug must contain only lowercase letters, numbers, and underscores"),
  description: z.string().optional(),
  fields: z.array(CustomFieldDefinitionSchema).min(1, "At least one field is required"),
});

export type CreateCustomTableSchemaDto = z.infer<typeof CreateCustomTableSchemaDto>;

export const UpdateCustomTableSchemaDto = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  fields: z.array(CustomFieldDefinitionSchema).min(1).optional(),
  isVisibleInSidebar: z.boolean().optional(),
});

export type UpdateCustomTableSchemaDto = z.infer<typeof UpdateCustomTableSchemaDto>;

export const RecordStatusSchema = z.enum(["pending", "confirmed", "cancelled", "completed"]);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

export const UpdateCustomRecordDto = z.object({
  status: RecordStatusSchema.optional(),
  notes: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateCustomRecordDto = z.infer<typeof UpdateCustomRecordDto>;
