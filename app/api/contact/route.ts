import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { contactSubmissionSchema } from "@/lib/domain/contact-schema";
import { sendMail } from "@/lib/services/mail";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = contactSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid submission", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, phone, message, source } = parsed.data;

    const submission = await db.contactSubmission.create({
      data: { name, email, phone: phone ?? null, message, source },
    });

    const adminEmail = process.env.ADMIN_CONTACT_EMAIL;
    if (adminEmail) {
      await sendMail({
        to: adminEmail,
        subject: `[Driplare] New contact — ${source}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:20px;">
            <h2 style="color:#6d28d9;">New Contact Submission</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ""}
            <p><strong>Source:</strong> ${source}</p>
            <p><strong>Message:</strong></p>
            <p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px;">${message}</p>
            <p style="font-size:12px;color:#666;margin-top:16px;">ID: ${submission.id}</p>
          </div>
        `,
      }).catch(console.error);
    }

    return NextResponse.json({ success: true, id: submission.id }, { status: 201 });
  } catch (error) {
    console.error("[CONTACT_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
