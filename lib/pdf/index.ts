// ─────────────────────────────────────────────────────────────
// lib/pdf/index.ts
// Central export for all PDF templates.
// Usage example:
//   import { generateInvoicePDF } from "@/lib/pdf";
//   const buffer = await generateInvoicePDF({ ... });
// ─────────────────────────────────────────────────────────────

export { generateInvoicePDF } from "@/lib/pdf/templates/invoice";
export type { InvoiceData } from "@/lib/pdf/templates/invoice";

export { generatePlanChangePDF } from "@/lib/pdf/templates/plan-change";
export type { PlanChangeData } from "@/lib/pdf/templates/plan-change";

export { generateCancellationPDF } from "@/lib/pdf/templates/cancellation";
export type { CancellationData } from "@/lib/pdf/templates/cancellation";
