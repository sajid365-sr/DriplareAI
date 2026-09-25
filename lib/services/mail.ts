import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendMailProps {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}

/**
 * Application-এর public base URL।
 *
 * আগে template-গুলোতে `https://driplare.com/...` হার্ডকোড করা ছিল — ফলে
 * preview deployment বা local development থেকে পাঠানো email-এর সব link
 * production-এ চলে যেত। এখন env থেকে আসে, তাই প্রতিটি environment-এ
 * সঠিক link যায়।
 */
export function getAppUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://driplare.com");

  return raw.replace(/\/+$/, "");
}

/** একটি path-এর absolute URL। */
export function appUrl(path: string): string {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Email-এর brand রঙ।
 *
 * ⚠️ Email client-গুলো CSS variable সাপোর্ট করে না, তাই এখানে literal মান
 * লাগে — কিন্তু সেগুলো এক জায়গায় রাখা হয় যাতে app-এর violet/blue theme
 * বদলালে শুধু এই block-টাই বদলাতে হয়।
 */
const BRAND = {
  primary: "#6d28d9", // violet — app-এর --primary
  warning: "#f59e0b",
  danger: "#dc2626",
  success: "#059669",
  text: "#374151",
  muted: "#666666",
  surface: "#f9fafb",
  border: "#eeeeee",
} as const;

/**
 * Utility function to send professional emails via Resend.
 * Easily switch to Amazon SES or others by updating this function.
 */
export async function sendMail({ to, subject, html, attachments }: SendMailProps) {
  try {
    const { data, error } = await resend.emails.send({
      from: "DRIPLARE AI <notifications@driplare.com>", // Note: You need to verify this domain in Resend
      to: [to],
      subject,
      html,
      attachments,
    });

    if (error) {
      console.error("[MAIL_ERROR]", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[MAIL_EXCEPTION]", error);
    return { success: false, error };
  }
}

// ─── Shared layout ───────────────────────────────────────────────────────────
// সব template একই খোলস ব্যবহার করে, তাই styling এক জায়গায় থাকে।

function button(label: string, url: string, color: string = BRAND.primary): string {
  return `<a href="${url}" style="display: inline-block; padding: 10px 20px; background-color: ${color}; color: #ffffff; text-decoration: none; border-radius: 5px; margin-top: 10px;">${label}</a>`;
}

function infoBox(rows: Array<[string, string]>, tone: "neutral" | "warning" | "danger" = "neutral"): string {
  const bg = tone === "warning" ? "#fffbeb" : tone === "danger" ? "#fef2f2" : BRAND.surface;
  const border = tone === "warning" ? "#fef3c7" : tone === "danger" ? "#fee2e2" : BRAND.border;

  return `
    <div style="background-color: ${bg}; padding: 15px; border: 1px solid ${border}; border-radius: 8px; margin: 20px 0;">
      ${rows
        .map(
          ([key, value]) =>
            `<p style="margin: 5px 0; color: ${BRAND.text};"><strong>${key}:</strong> ${value}</p>`
        )
        .join("")}
    </div>
  `;
}

/** সব email-এর সাধারণ খোলস — header, footer ও typography। */
function layout(args: {
  title: string;
  titleColor?: string;
  body: string;
  footnote?: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid ${BRAND.border}; border-radius: 10px;">
      <h2 style="color: ${args.titleColor ?? BRAND.primary};">${args.title}</h2>
      ${args.body}
      <hr style="border: 0; border-top: 1px solid ${BRAND.border}; margin: 20px 0;">
      ${args.footnote ? `<p style="font-size: 12px; color: ${BRAND.muted};">${args.footnote}</p>` : ""}
      <p style="font-size: 12px; color: ${BRAND.muted};">&copy; 2026 DRIPLARE AI. All rights reserved.</p>
    </div>
  `;
}

/**
 * Predefined templates for common SaaS events
 */
export const MailTemplates = {
  dataExport: (name: string) =>
    layout({
      title: "DRIPLARE AI",
      body: `
        <p>Hello ${name},</p>
        <p>Your requested personal data export is ready. Attached to this email, you will find:</p>
        <ul>
          <li><strong>JSON File:</strong> Complete technical data for portability.</li>
          <li><strong>CSV Files:</strong> Human-readable files for your chatbots and usage activity (viewable in Excel).</li>
        </ul>
        <p>These files are intended for your records. Please keep them secure as they contain sensitive information.</p>
      `,
      footnote: "If you did not request this export, please contact our support immediately.",
    }),

  planUpgrade: (name: string, planName: string) =>
    layout({
      title: `Welcome to ${planName}!`,
      body: `
        <p>Hello ${name},</p>
        <p>Congratulations! Your account has been successfully upgraded to the <strong>${planName}</strong> plan.</p>
        <p>You now have access to higher message limits and premium features. Check your dashboard to start exploring.</p>
        ${button("Go to Dashboard", appUrl("/dashboard"))}
      `,
    }),

  paymentReceipt: (name: string, planName: string, amount: string) =>
    layout({
      title: "Payment Successful!",
      body: `
        <p>Hello ${name},</p>
        <p>Thank you for your payment. Your account has been upgraded to the <strong>${planName.toUpperCase()}</strong> plan.</p>
        <p>We have attached the official invoice (PDF) to this email for your records.</p>
        ${infoBox([
          ["Plan", planName.toUpperCase()],
          ["Amount Paid", amount],
          ["Status", "Completed"],
        ])}
        <p>You can now enjoy all the premium features of DRIPLARE AI.</p>
        ${button("Go to Dashboard", appUrl("/dashboard"))}
      `,
    }),

  /**
   * 80% / 100% credit usage alert।
   *
   * `upgradeUrl` parameter হিসেবে নেওয়া হয় — আগে link-টি হার্ডকোড ছিল, ফলে
   * merchant কোন plan-এ upgrade করবে সেটি email থেকে বোঝা যেত না।
   */
  usageAlert: (name: string, percent: number, limit: number, upgradeUrl?: string) => {
    const used = Math.floor(limit * (percent / 100));
    const isExhausted = percent >= 100;

    return layout({
      title: `Usage Alert: ${percent}% Reached`,
      titleColor: isExhausted ? BRAND.danger : BRAND.warning,
      body: `
        <p>Hello ${name},</p>
        <p>You have used <strong>${percent}%</strong> of your monthly credit quota.</p>
        ${infoBox(
          [
            ["Current Usage", `${used.toLocaleString()} / ${limit.toLocaleString()} credits`],
            ["Remaining", `${Math.max(0, limit - used).toLocaleString()} credits`],
          ],
          isExhausted ? "danger" : "warning"
        )}
        <p>${
          isExhausted
            ? "Your credits are exhausted — AI replies have stopped. Renew or top up now to restore service."
            : "Consider upgrading your plan or topping up credits to avoid any service interruption."
        }</p>
        ${button(
          isExhausted ? "Renew Now" : "Upgrade / Top-up",
          upgradeUrl ?? appUrl("/dashboard/payment")
        )}
      `,
      footnote:
        "You are receiving this because usage alerts are enabled in your notification settings.",
    });
  },

  securityAlert: (name: string, event: string, details: string) =>
    layout({
      title: `Security Alert: ${event}`,
      titleColor: BRAND.danger,
      body: `
        <p>Hello ${name},</p>
        <p>This is a security notification regarding your account. A significant activity was detected:</p>
        ${infoBox(
          [
            ["Activity", event],
            ["Details", details],
            ["Time", new Date().toLocaleString()],
          ],
          "danger"
        )}
        <p>If this was you, you can safely ignore this email. If you don't recognize this activity, please reset your password immediately and secure your account.</p>
        ${button("Secure Account", appUrl("/dashboard/settings"), BRAND.danger)}
      `,
    }),

  productUpdate: (name: string, title: string, content: string, linkLabel: string, linkUrl: string) =>
    layout({
      title,
      body: `
        <p>Hello ${name},</p>
        <p>${content}</p>
        ${button(linkLabel, linkUrl)}
      `,
      footnote:
        "You received this email because you're subscribed to Product Updates. You can unsubscribe anytime in your account settings.",
    }),

  // ─── Billing lifecycle templates ──────────────────────────────────────────
  // নিচের template-গুলো admin invoice, ব্যর্থ payment ও refund-এর জন্য।

  /**
   * Admin-এর তৈরি করা payable invoice — merchant এই email পায়।
   * `payUrl` merchant-কে সরাসরি invoice page-এ নিয়ে যায়, যেখানে "Pay Now"
   * button আছে। (Direct gateway link নয় — সেটি session-নির্ভর ও expire হয়।)
   */
  invoiceIssued: (args: {
    name: string;
    invoiceNumber: string;
    description: string;
    amount: string;
    dueDate?: string;
    payUrl: string;
  }) =>
    layout({
      title: "New Invoice from DRIPLARE AI",
      body: `
        <p>Hello ${args.name},</p>
        <p>An invoice has been issued for your DRIPLARE AI account. The official PDF is attached to this email.</p>
        ${infoBox([
          ["Invoice", args.invoiceNumber],
          ["Description", args.description],
          ["Amount Due", args.amount],
          ...(args.dueDate ? [["Due Date", args.dueDate] as [string, string]] : []),
        ])}
        <p>Click the button below to view the invoice and complete the payment securely. Your credits will be added automatically once the payment is confirmed.</p>
        ${button("Pay Now", args.payUrl)}
      `,
      footnote: "If you have already paid, you can ignore this email.",
    }),

  /** Invoice পরিশোধ হলে merchant-এর receipt। */
  invoicePaid: (args: {
    name: string;
    invoiceNumber: string;
    description: string;
    amount: string;
    creditsGranted?: number;
  }) =>
    layout({
      title: "Payment Received — Thank You!",
      titleColor: BRAND.success,
      body: `
        <p>Hello ${args.name},</p>
        <p>We have received your payment. The official invoice (PDF) is attached for your records.</p>
        ${infoBox([
          ["Invoice", args.invoiceNumber],
          ["Description", args.description],
          ["Amount Paid", args.amount],
          ...(args.creditsGranted
            ? [["Credits Added", args.creditsGranted.toLocaleString()] as [string, string]]
            : []),
        ])}
        ${button("Go to Dashboard", appUrl("/dashboard"))}
      `,
    }),

  /** Payment ব্যর্থ — merchant-কে জানিয়ে আবার চেষ্টা করার link। */
  paymentFailed: (args: {
    name: string;
    description: string;
    amount: string;
    reason?: string;
    retryUrl: string;
  }) =>
    layout({
      title: "Payment Failed",
      titleColor: BRAND.danger,
      body: `
        <p>Hello ${args.name},</p>
        <p>Unfortunately your recent payment could not be completed, so the order was not applied to your account.</p>
        ${infoBox(
          [
            ["Description", args.description],
            ["Amount", args.amount],
            ...(args.reason ? [["Reason", args.reason] as [string, string]] : []),
          ],
          "danger"
        )}
        <p>No charge has been made. You can retry the payment using the button below — if the problem persists, please contact our support team.</p>
        ${button("Retry Payment", args.retryUrl)}
      `,
    }),

  /** Refund request-এর অবস্থা পরিবর্তন হলে merchant-কে জানানো হয়। */
  refundUpdate: (args: {
    name: string;
    invoiceNumber?: string | null;
    amount: string;
    status: "approved" | "rejected" | "refunded";
    adminNote?: string | null;
  }) => {
    const copy = {
      approved: {
        title: "Refund Approved",
        tone: "neutral" as const,
        message:
          "Your refund request has been approved and is now being processed. Depending on your bank or gateway, it may take 5–10 business days to appear.",
      },
      rejected: {
        title: "Refund Request Declined",
        tone: "danger" as const,
        message:
          "After reviewing your request, we are unable to issue a refund for this payment. If you believe this is a mistake, please contact our support team.",
      },
      refunded: {
        title: "Refund Completed",
        tone: "neutral" as const,
        message:
          "Your refund has been completed. Depending on your bank or gateway, it may take 5–10 business days to appear on your statement.",
      },
    }[args.status];

    return layout({
      title: copy.title,
      titleColor: args.status === "rejected" ? BRAND.danger : BRAND.success,
      body: `
        <p>Hello ${args.name},</p>
        ${infoBox(
          [
            ...(args.invoiceNumber ? [["Invoice", args.invoiceNumber] as [string, string]] : []),
            ["Amount", args.amount],
            ["Status", args.status.toUpperCase()],
            ...(args.adminNote ? [["Note", args.adminNote] as [string, string]] : []),
          ],
          copy.tone
        )}
        <p>${copy.message}</p>
        ${button("Go to Dashboard", appUrl("/dashboard"))}
      `,
    });
  },

  // ─── Merchant feedback templates ──────────────────────────────────────────
  // ব্যর্থ বা অসম্পূর্ণ কোনো কিছু merchant রিপোর্ট করলে admin-কে জানানো হয়,
  // আর admin উত্তর দিলে বা status বদলালে merchant-কে জানানো হয়।

  /**
   * Admin-কে নতুন feedback-এর notification। Merchant-এর দেওয়া auto-context
   * (পেজ, browser, workspace) এখানেই থাকে, যাতে admin আলাদা করে জিজ্ঞেস না করে
   * সরাসরি সমস্যাটি reproduce করতে পারেন।
   */
  feedbackReceived: (args: {
    merchantName: string;
    merchantEmail: string;
    subject: string;
    message: string;
    pageUrl?: string | null;
    workspaceId?: string | null;
    chatbotId?: string | null;
    attachments: { kind: string; label: string }[];
    feedbackUrl: string;
  }) =>
    layout({
      title: "New Merchant Feedback",
      body: `
        <p><strong>${args.merchantName}</strong> (${args.merchantEmail}) submitted feedback from the dashboard.</p>
        ${infoBox([
          ["Subject", args.subject],
          ...(args.pageUrl ? [["Page", args.pageUrl] as [string, string]] : []),
          ...(args.workspaceId ? [["Workspace", args.workspaceId] as [string, string]] : []),
          ...(args.chatbotId ? [["Bot", args.chatbotId] as [string, string]] : []),
        ])}
        <p><strong>Message:</strong></p>
        <p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px;">${args.message}</p>
        ${
          args.attachments.length
            ? `<p><strong>Attachments (${args.attachments.length}):</strong></p>
               <ul>${args.attachments
                 .map((a) => `<li>${a.kind} — ${a.label}</li>`)
                 .join("")}</ul>`
            : ""
        }
        ${button("Open in Admin Panel", args.feedbackUrl)}
      `,
      footnote: "Reply from the admin panel — the merchant is notified automatically.",
    }),

  /**
   * Admin feedback-এ উত্তর দিলে বা status বদলালে merchant এই email পায়।
   * `replyBody` না থাকলে শুধু status পরিবর্তনের বার্তা যায়।
   */
  feedbackReply: (args: {
    name: string;
    subject: string;
    replyBody?: string | null;
    statusLabel?: string | null;
    feedbackUrl: string;
  }) =>
    layout({
      title: "Update on Your Feedback",
      titleColor: BRAND.success,
      body: `
        <p>Hello ${args.name},</p>
        <p>There is an update on the feedback you submitted: <strong>${args.subject}</strong></p>
        ${
          args.replyBody
            ? `<p><strong>Our team replied:</strong></p>
               <p style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:8px;">${args.replyBody}</p>`
            : ""
        }
        ${args.statusLabel ? infoBox([["Status", args.statusLabel]]) : ""}
        <p>You can read the full conversation and reply back from your dashboard.</p>
        ${button("View Conversation", args.feedbackUrl)}
      `,
      footnote: "You are receiving this because you submitted feedback on DRIPLARE AI.",
    }),
};
