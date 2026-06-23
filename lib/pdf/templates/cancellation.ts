import "server-only";

// ─────────────────────────────────────────────────────────────
// lib/pdf/templates/cancellation.ts
// Subscription Cancellation Notification PDF Template
// ─────────────────────────────────────────────────────────────

import {
  createDoc,
  drawHeader,
  drawFooter,
  drawSignatureBlock,
  drawSectionLabel,
  PDF_BRAND,
  PAGE,
  BRAND_EMAIL,
  BRAND_NAME,
} from "@/lib/pdf/core";

export interface CancellationData {
  notificationNumber: string;  // e.g. "CAN-2026-001"
  date: string;                // formatted date of cancellation request
  userName: string;
  userEmail: string;
  planName: string;            // plan being cancelled
  cancelledAt: string;         // formatted date of cancellation request
  effectiveDate: string;       // when cancellation takes effect (end of billing period)
  cancelReason?: string;       // optional reason
}

/**
 * Generates a Subscription Cancellation notification PDF.
 * Returns a Buffer ready to be served via an API response.
 */
export async function generateCancellationPDF(data: CancellationData): Promise<Buffer> {
  const { doc } = await createDoc();
  const { W, MARGIN } = PAGE;

  // ── Header ──────────────────────────────────────────────────
  await drawHeader(doc, "Subscription Cancellation Confirmation");

  // ── Ref No ──────────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_BRAND.white);
  doc.text(`Ref: ${data.notificationNumber}`, W - MARGIN, 20, { align: "right" });

  // ── Warning Banner ───────────────────────────────────────────
  const bannerY = 46;
  doc.setFillColor(254, 242, 242);
  doc.roundedRect(MARGIN, bannerY, W - 2 * MARGIN, 14, 2, 2, "F");
  doc.setDrawColor(...PDF_BRAND.danger);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, bannerY, W - 2 * MARGIN, 14, 2, 2, "S");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.danger);
  doc.text(
    `⚠  Your ${data.planName.toUpperCase()} subscription has been scheduled for cancellation.`,
    W / 2,
    bannerY + 9,
    { align: "center" }
  );

  // ── Greeting ─────────────────────────────────────────────────
  const greetY = bannerY + 22;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.dark);
  doc.text(`Dear ${data.userName},`, MARGIN, greetY);

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_BRAND.gray);
  doc.text(
    "We have received your cancellation request. Your plan will remain active until the effective",
    MARGIN,
    greetY + 8
  );
  doc.text(
    "date shown below. You can continue using all features until that date.",
    MARGIN,
    greetY + 14
  );

  // ── Details Table ────────────────────────────────────────────
  const detailsY = greetY + 24;
  drawSectionLabel(doc, "Cancellation Details", detailsY);

  doc.setFillColor(255, 249, 249);
  doc.roundedRect(MARGIN, detailsY + 4, W - 2 * MARGIN, 36, 2, 2, "F");

  const details: [string, string][] = [
    ["Account", data.userEmail],
    ["Cancelled Plan", data.planName.toUpperCase()],
    ["Cancellation Requested", data.cancelledAt],
    ["Plan Remains Active Until", data.effectiveDate],
    ["Notification Date", data.date],
  ];
  if (data.cancelReason) {
    details.push(["Reason", data.cancelReason]);
  }

  details.forEach(([label, value], i) => {
    const rowY = detailsY + 12 + i * 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_BRAND.gray);
    doc.text(label + ":", MARGIN + 5, rowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_BRAND.dark);
    doc.text(value, MARGIN + 70, rowY);
  });

  // ── Re-activation Note ───────────────────────────────────────
  const noteY = detailsY + 12 + details.length * 6 + 6;
  doc.setFillColor(240, 255, 248);
  doc.roundedRect(MARGIN, noteY, W - 2 * MARGIN, 18, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.success);
  doc.text("Want to stay?", MARGIN + 5, noteY + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_BRAND.gray);
  doc.text(
    "You can reactivate your subscription anytime from your dashboard before the effective date.",
    MARGIN + 5,
    noteY + 13
  );

  // ── Signature ────────────────────────────────────────────────
  await drawSignatureBlock(doc, 248);

  // ── Footer ───────────────────────────────────────────────────
  drawFooter(doc, `${BRAND_NAME}  •  ${BRAND_EMAIL}`);

  return Buffer.from(doc.output("arraybuffer"));
}
