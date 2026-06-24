import "server-only";

// ─────────────────────────────────────────────────────────────
// lib/pdf/templates/invoice.ts
// Enterprise-level Payment Invoice PDF Template
// ─────────────────────────────────────────────────────────────

import {
  createDoc,
  drawFooter,
  drawSignatureBlock,
  drawGradient,
  PDF_BRAND,
  PAGE,
  BRAND_EMAIL,
  BRAND_TAGLINE,
} from "@/lib/pdf/core";

export interface InvoiceData {
  invoiceNumber: string;
  date: string;
  userName: string;
  userEmail: string;
  planName: string;
  amount: number;
  currency: string;
  gateway: string;
  transactionId: string;
  status: string;
}

/**
 * Generates a premium enterprise-level Payment Invoice PDF.
 * Returns a Buffer ready to be served via an API response.
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const { doc, autoTable } = await createDoc();
  const { W, MARGIN } = PAGE;
  const [pr, pg, pb] = PDF_BRAND.primary;

  const isUnpaid =
    data.status?.toLowerCase() === "pending" ||
    data.status?.toLowerCase() === "unpaid" ||
    data.status?.toLowerCase() === "failed";

  // ── 1. HEADER BAND (Premium Gradient) ─────────────────────────
  // Gradient from primary (violet) to a deep indigo
  const colorStart = PDF_BRAND.primary;
  const colorEnd: [number, number, number] = [79, 70, 229]; // Indigo
  drawGradient(doc, 0, 0, W, 50, colorStart, colorEnd);

  // Subtle accent stripe at bottom of header
  doc.setFillColor(140, 80, 240);
  doc.rect(0, 46, W, 4, "F");

  // ── Logo (left) ───────────────────────────────────────────────
  let logoLoaded = false;
  try {
    const fs = await import("fs");
    const path = await import("path");
    // Use white logo on the dark header background
    const logoPath = path.join(process.cwd(), "public", "header-logo-white.png");
    if (fs.existsSync(logoPath)) {
      const logoData = fs.readFileSync(logoPath).toString("base64");
      // Logo with perfect 3:1 aspect ratio: width=48, height=16
      doc.addImage(logoData, "PNG", MARGIN, 11, 48, 16);
      logoLoaded = true;
    }
  } catch {
    // Fallback to text if logo not found
  }

  if (!logoLoaded) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("DRIPLARE AI", MARGIN, 22);
  }

  // ── Invoice label + number (right side of header) ─────────────
  // Right column starts at x=125
  const rightColX = 125;

  doc.setTextColor(200, 185, 240); // muted lavender
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", rightColX, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.invoiceNumber, rightColX, 20);

  // Unpaid pill badge
  if (isUnpaid) {
    doc.setFillColor(239, 68, 68); // Danger red
    doc.roundedRect(rightColX + 42, 14, 18, 6, 1, 1, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("UNPAID", rightColX + 51, 18.2, { align: "center" });
  }

  doc.setTextColor(200, 185, 240);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("DATE", rightColX, 28);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(data.date, rightColX, 34);

  doc.setTextColor(200, 185, 240);
  doc.setFontSize(7);
  doc.text(BRAND_TAGLINE, rightColX, 42);

  // ── 2. BILL TO / FROM — Two columns ──────────────────────────
  const infoY = 62;
  const halfW = (W - 2 * MARGIN) / 2;
  const leftColX = MARGIN;
  const fromColX = MARGIN + halfW + 8;

  // ── Left: Billed To ──────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 140, 170);
  doc.text("BILLED TO", leftColX, infoY);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_BRAND.dark[0], PDF_BRAND.dark[1], PDF_BRAND.dark[2]);
  doc.text(data.userName, leftColX, infoY + 7);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_BRAND.gray[0], PDF_BRAND.gray[1], PDF_BRAND.gray[2]);
  doc.text(data.userEmail, leftColX, infoY + 13);

  // ── Right: From ───────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 140, 170);
  doc.text("FROM", fromColX, infoY);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_BRAND.dark[0], PDF_BRAND.dark[1], PDF_BRAND.dark[2]);
  doc.text("Driplare AI", fromColX, infoY + 7);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_BRAND.gray[0], PDF_BRAND.gray[1], PDF_BRAND.gray[2]);
  doc.text(BRAND_EMAIL, fromColX, infoY + 13);

  // Thin divider
  doc.setDrawColor(220, 215, 235);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, infoY + 19, W - MARGIN, infoY + 19);

  // ── 3. ITEM TABLE ─────────────────────────────────────────────
  const tableStartY = infoY + 26;

  autoTable(doc, {
    startY: tableStartY,
    head: [["#", "Description", "Qty", "Unit Price", "Total"]],
    body: [
      [
        "01",
        `Driplare AI — ${data.planName.toUpperCase()} Plan\nMonthly Subscription`,
        "1",
        `${data.amount.toLocaleString()} ${data.currency.toUpperCase()}`,
        `${data.amount.toLocaleString()} ${data.currency.toUpperCase()}`,
      ],
    ],
    theme: "grid",
    headStyles: {
      fillColor: PDF_BRAND.primary,
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
      textColor: [40, 30, 60],
    },
    alternateRowStyles: { fillColor: [250, 248, 255] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 38, halign: "right" },
      4: { cellWidth: 38, halign: "right", fontStyle: "bold" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });

  const tableEndY = (doc as any).lastAutoTable.finalY;

  // ── 4. TOTALS BLOCK ────────────────────────────────────────────
  const totalsBoxX = W - MARGIN - 75;
  const totalsBoxY = tableEndY + 6;
  const totalsBoxW = 75;
  const totalsBoxH = 34;

  // Light background for totals
  doc.setFillColor(248, 245, 255);
  doc.roundedRect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH, 2, 2, "F");
  doc.setDrawColor(210, 200, 235);
  doc.setLineWidth(0.3);
  doc.roundedRect(totalsBoxX, totalsBoxY, totalsBoxW, totalsBoxH, 2, 2, "S");

  const tX = totalsBoxX + 5;
  const tRight = W - MARGIN;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_BRAND.gray[0], PDF_BRAND.gray[1], PDF_BRAND.gray[2]);
  doc.text("Subtotal:", tX, totalsBoxY + 9);
  doc.text("Tax / VAT (0%):", tX, totalsBoxY + 16);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_BRAND.dark[0], PDF_BRAND.dark[1], PDF_BRAND.dark[2]);
  // Add 5mm right padding inside totals box
  doc.text(
    `${data.amount.toLocaleString()} ${data.currency.toUpperCase()}`,
    tRight - 5,
    totalsBoxY + 9,
    { align: "right" }
  );
  doc.text("0.00", tRight - 5, totalsBoxY + 16, { align: "right" });

  // Separator inside box
  doc.setDrawColor(210, 200, 235);
  doc.line(tX, totalsBoxY + 20, tRight - 5, totalsBoxY + 20);

  // Total row — larger, color changes based on status
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  if (isUnpaid) {
    doc.setTextColor(239, 68, 68); // Red for unpaid total due
    doc.text("Total Due:", tX, totalsBoxY + 28);
  } else {
    doc.setTextColor(pr, pg, pb); // Violet for paid total
    doc.text("Total Paid:", tX, totalsBoxY + 28);
  }
  doc.text(
    `${data.amount.toLocaleString()} ${data.currency.toUpperCase()}`,
    tRight - 5,
    totalsBoxY + 28,
    { align: "right" }
  );

  // ── 5. PAYMENT DETAILS (left of totals block) ─────────────────
  const detailsY = tableEndY + 6;
  const detailsW = W - MARGIN - totalsBoxW - MARGIN - 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(150, 140, 170);
  doc.text("PAYMENT DETAILS", MARGIN, detailsY + 5);

  doc.setFillColor(248, 245, 255);
  doc.roundedRect(MARGIN, detailsY + 8, detailsW, 26, 2, 2, "F");

  const details = [
    ["Gateway", data.gateway ? data.gateway.toUpperCase() : "N/A"],
    ["Transaction ID", data.transactionId ? data.transactionId.slice(0, 30) : "PENDING"],
    ["Status", data.status.toUpperCase()],
    ["Plan", `${data.planName.toUpperCase()} Monthly`],
  ];

  details.forEach(([label, value], i) => {
    const rowY = detailsY + 15 + i * 5.5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(PDF_BRAND.gray[0], PDF_BRAND.gray[1], PDF_BRAND.gray[2]);
    doc.text(`${label}:`, MARGIN + 3, rowY);
    doc.setFont("helvetica", "bold");

    if (label === "Status" && isUnpaid) {
      doc.setTextColor(239, 68, 68); // Red text for unpaid status
    } else {
      doc.setTextColor(PDF_BRAND.dark[0], PDF_BRAND.dark[1], PDF_BRAND.dark[2]);
    }
    doc.text(value, MARGIN + 35, rowY);
  });

  // ── 6. SIGNATURE ──────────────────────────────────────────────
  await drawSignatureBlock(doc, 248);

  // ── 7. THANK YOU NOTE ─────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 140, 170);
  doc.text(
    isUnpaid
      ? "Please complete the payment to enjoy uninterrupted services."
      : "Thank you for choosing Driplare AI. We appreciate your business.",
    W / 2,
    242,
    { align: "center" }
  );

  // ── 8. FOOTER ─────────────────────────────────────────────────
  drawFooter(doc, `Questions? Contact us at ${BRAND_EMAIL}`);

  return Buffer.from(doc.output("arraybuffer"));
}
