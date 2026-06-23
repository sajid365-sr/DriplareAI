import "server-only";

// ─────────────────────────────────────────────────────────────
// lib/pdf/templates/plan-change.ts
// Plan Upgrade / Downgrade Notification PDF Template
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

export interface PlanChangeData {
  notificationNumber: string;   // e.g. "PCN-2026-001"
  date: string;                 // formatted display date
  userName: string;
  userEmail: string;
  fromPlan: string;             // e.g. "Growth"
  toPlan: string;               // e.g. "Business"
  effectiveDate: string;        // formatted effective date
  changeType: "upgrade" | "downgrade";
}

/**
 * Generates a Plan Change (Upgrade/Downgrade) notification PDF.
 * Returns a Buffer ready to be served via an API response.
 */
export async function generatePlanChangePDF(data: PlanChangeData): Promise<Buffer> {
  const { doc } = await createDoc();
  const { W, MARGIN } = PAGE;

  const isUpgrade = data.changeType === "upgrade";
  const accentColor = isUpgrade ? PDF_BRAND.success : PDF_BRAND.warning;
  const typeLabel = isUpgrade ? "Plan Upgrade Confirmation" : "Plan Downgrade Notification";

  // ── Header ──────────────────────────────────────────────────
  await drawHeader(doc, typeLabel);

  // ── Notification No ─────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_BRAND.white);
  doc.text(`Ref: ${data.notificationNumber}`, W - MARGIN, 20, { align: "right" });

  // ── Greeting ─────────────────────────────────────────────────
  const greetY = 52;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.dark);
  doc.text(`Dear ${data.userName},`, MARGIN, greetY);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_BRAND.gray);
  const msgLines = isUpgrade
    ? [
        "Congratulations! Your subscription plan has been successfully upgraded.",
        "Your new plan and its benefits are now active.",
      ]
    : [
        "This notification confirms that your subscription plan change has been scheduled.",
        "Your current plan will remain active until the effective date below.",
      ];
  msgLines.forEach((line, i) => {
    doc.text(line, MARGIN, greetY + 8 + i * 6);
  });

  // ── Plan Change Visual ───────────────────────────────────────
  const boxY = greetY + 26;
  const boxH = 36;
  const halfW = (W - 2 * MARGIN) / 2 - 5;

  // From Plan box
  doc.setFillColor(240, 238, 248);
  doc.roundedRect(MARGIN, boxY, halfW, boxH, 3, 3, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.gray);
  doc.text("FROM PLAN", MARGIN + 5, boxY + 8);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.dark);
  doc.text(data.fromPlan.toUpperCase(), MARGIN + 5, boxY + 22);

  // Arrow
  const arrowX = MARGIN + halfW + 5;
  doc.setFontSize(18);
  doc.setTextColor(...accentColor);
  doc.text("→", arrowX, boxY + 22);

  // To Plan box
  const toPlanX = arrowX + 10;
  doc.setFillColor(
    accentColor[0], accentColor[1], accentColor[2]
  );
  doc.setGState((doc as any).GState({ opacity: 0.12 }));
  doc.roundedRect(toPlanX, boxY, halfW, boxH, 3, 3, "F");
  doc.setGState((doc as any).GState({ opacity: 1 }));

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BRAND.gray);
  doc.text("TO PLAN", toPlanX + 5, boxY + 8);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accentColor);
  doc.text(data.toPlan.toUpperCase(), toPlanX + 5, boxY + 22);

  // ── Details Table ────────────────────────────────────────────
  const detailsY = boxY + boxH + 12;
  drawSectionLabel(doc, "Change Details", detailsY);

  doc.setFillColor(248, 246, 255);
  doc.roundedRect(MARGIN, detailsY + 4, W - 2 * MARGIN, 30, 2, 2, "F");

  const details = [
    ["Account", data.userEmail],
    ["Change Type", isUpgrade ? "Upgrade ↑" : "Downgrade ↓"],
    ["Effective Date", data.effectiveDate],
    ["Notification Date", data.date],
  ];
  details.forEach(([label, value], i) => {
    const rowY = detailsY + 12 + i * 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_BRAND.gray);
    doc.text(label + ":", MARGIN + 5, rowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_BRAND.dark);
    doc.text(value, MARGIN + 55, rowY);
  });

  // ── Note ─────────────────────────────────────────────────────
  const noteY = detailsY + 42;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...PDF_BRAND.gray);
  const noteText = isUpgrade
    ? "All features of your new plan are immediately available. Thank you for upgrading!"
    : "Your existing chatbots and integrations remain active until the effective date.";
  doc.text(noteText, MARGIN, noteY);

  // ── Signature ────────────────────────────────────────────────
  await drawSignatureBlock(doc, 248);

  // ── Footer ───────────────────────────────────────────────────
  drawFooter(doc, `${BRAND_NAME}  •  ${BRAND_EMAIL}`);

  return Buffer.from(doc.output("arraybuffer"));
}
