import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { getActiveWorkspace } from "@/lib/core/workspace-server";
import { z } from "zod";

const importContactSchema = z.object({
  name: z.string().trim().max(255).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  lifecycleStage: z
    .enum(["new", "engaged", "qualified", "customer", "repeat", "lapsed"])
    .default("new"),
  source: z.string().trim().max(50).optional().nullable(),
  primaryAddress: z.string().trim().max(500).optional().nullable(),
  district: z.string().trim().max(100).optional().nullable(),
});

const importBodySchema = z.object({
  contacts: z.array(importContactSchema).min(1).max(500),
});

type ImportContactInput = z.infer<typeof importContactSchema>;

interface SkippedContact {
  index: number;
  input: ImportContactInput;
  reason: string;
  existingContactId: string;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/crm/contacts/import
// Bulk import contacts from CSV / JSON data.
// Max 500 contacts per request.
// ═══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(user.userId);

    const body = await req.json() as unknown;
    const parsed = importBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { contacts } = parsed.data;

    let created = 0;
    let skipped = 0;
    const skippedContacts: SkippedContact[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];

      // Need at least one of phone or email to check for duplicates
      if (!c.phone && !c.email && !c.name) {
        skipped++;
        skippedContacts.push({
          index: i,
          input: c,
          reason: "No identifying information (name, email, or phone required)",
          existingContactId: "",
        });
        continue;
      }

      // Check for existing phone/email duplicate in workspace
      if (c.phone || c.email) {
        const orConditions: { phone?: string; email?: string }[] = [];
        if (c.phone) orConditions.push({ phone: c.phone });
        if (c.email) orConditions.push({ email: c.email });

        const existing = await db.contact.findFirst({
          where: {
            workspaceId: workspace.workspaceId,
            OR: orConditions,
          },
          select: { contactId: true },
        });

        if (existing) {
          skipped++;
          skippedContacts.push({
            index: i,
            input: c,
            reason: "Duplicate phone or email already exists in workspace",
            existingContactId: existing.contactId,
          });
          continue;
        }
      }

      // Create the contact
      await db.contact.create({
        data: {
          workspaceId: workspace.workspaceId,
          name: c.name,
          email: c.email,
          phone: c.phone,
          lifecycleStage: c.lifecycleStage,
          source: c.source ?? "csv_import",
          primaryAddress: c.primaryAddress,
          district: c.district,
        },
      });

      created++;
    }

    return NextResponse.json({
      created,
      skipped,
      skippedContacts,
    });
  } catch (error) {
    console.error("[CRM_CONTACTS_IMPORT_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
