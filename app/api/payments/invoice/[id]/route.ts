import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { generateInvoicePDF } from "@/lib/pdf";
import { format } from "date-fns";

// ─────────────────────────────────────────────────────────────
// GET /api/payments/invoice/[id]
// Returns a PDF invoice for a completed payment transaction.
// Only the transaction owner can download their invoice.
// ─────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params is a Promise and must be awaited
    const { id } = await params;

    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use findFirst since only sessionId has @unique, not id
    const tx = await db.paymentTransaction.findFirst({
      where: { id },
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Security: ensure the transaction belongs to this user
    if (tx.userId !== user.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Generate invoices for completed or pending transactions
    const isAllowed =
      tx.status === "complete" ||
      tx.status === "completed" ||
      tx.status === "pending" ||
      tx.paymentStatus === "complete" ||
      tx.paymentStatus === "completed" ||
      tx.paymentStatus === "pending";

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Invoice is not available for this transaction status." },
        { status: 400 }
      );
    }

    // Build a human-readable invoice number
    const invoiceNumber = `INV-${format(new Date(tx.createdAt), "yyyyMM")}-${tx.id.slice(-6).toUpperCase()}`;

    // Derive plan name from packageId (e.g. "growth_bdt" → "Growth")
    const planName =
      tx.packageId.split("_")[0].charAt(0).toUpperCase() +
      tx.packageId.split("_")[0].slice(1);

    const pdfBuffer = await generateInvoicePDF({
      invoiceNumber,
      date: format(new Date(tx.createdAt), "dd MMM yyyy, HH:mm"),
      userName: user.name || user.email || "Customer",
      userEmail: user.email || "",
      planName,
      amount: tx.amount,
      currency: tx.currency?.toUpperCase() || "BDT",
      gateway: tx.gateway || "Unknown",
      transactionId: tx.sessionId || tx.id,
      status: tx.status,
    });

    // Return PDF as a downloadable file
    const filename = `driplare-invoice-${invoiceNumber}.pdf`;
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[INVOICE_PDF_GET]", error);
    return NextResponse.json({ error: "Failed to generate invoice" }, { status: 500 });
  }
}
