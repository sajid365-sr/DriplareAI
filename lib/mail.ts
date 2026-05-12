import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendMailProps {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}

/**
 * Utility function to send professional emails via Resend.
 * Easily switch to Amazon SES or others by updating this function.
 */
export async function sendMail({ to, subject, html, attachments }: SendMailProps) {
  try {
    const { data, error } = await resend.emails.send({
      from: "Driplare AI <notifications@driplare.com>", // Note: You need to verify this domain in Resend
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

/**
 * Predefined templates for common SaaS events
 */
export const MailTemplates = {
  dataExport: (name: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #6d28d9;">Driplare AI</h2>
      <p>Hello ${name},</p>
      <p>Your requested personal data export is ready. Attached to this email, you will find:</p>
      <ul>
        <li><strong>JSON File:</strong> Complete technical data for portability.</li>
        <li><strong>CSV Files:</strong> Human-readable files for your chatbots and usage activity (viewable in Excel).</li>
      </ul>
      <p>These files are intended for your records. Please keep them secure as they contain sensitive information.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">If you did not request this export, please contact our support immediately.</p>
      <p style="font-size: 12px; color: #666;">&copy; 2026 Driplare AI. All rights reserved.</p>
    </div>
  `,
  
  planUpgrade: (name: string, planName: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #6d28d9;">Welcome to ${planName}!</h2>
      <p>Hello ${name},</p>
      <p>Congratulations! Your account has been successfully upgraded to the <strong>${planName}</strong> plan.</p>
      <p>You now have access to higher message limits and premium features. Check your dashboard to start exploring.</p>
      <a href="https://driplare.com/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #6d28d9; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Go to Dashboard</a>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">&copy; 2026 Driplare AI. All rights reserved.</p>
    </div>
  `,

  paymentReceipt: (name: string, planName: string, amount: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #6d28d9;">Payment Successful!</h2>
      <p>Hello ${name},</p>
      <p>Thank you for your payment. Your account has been upgraded to the <strong>${planName.toUpperCase()}</strong> plan.</p>
      <p>We have attached the official invoice (PDF) to this email for your records.</p>
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Plan:</strong> ${planName.toUpperCase()}</p>
        <p style="margin: 5px 0;"><strong>Amount Paid:</strong> ${amount}</p>
        <p style="margin: 5px 0;"><strong>Status:</strong> Completed</p>
      </div>
      <p>You can now enjoy all the premium features of Driplare AI.</p>
      <a href="https://driplare.com/dashboard" style="display: inline-block; padding: 10px 20px; background-color: #6d28d9; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Go to Dashboard</a>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">&copy; 2026 Driplare AI. All rights reserved.</p>
    </div>
  `,

  usageAlert: (name: string, percent: number, limit: number) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #f59e0b;">Usage Alert: ${percent}% Reached</h2>
      <p>Hello ${name},</p>
      <p>You have used <strong>${percent}%</strong> of your monthly message quota.</p>
      <div style="background-color: #fffbeb; padding: 15px; border: 1px solid #fef3c7; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Current Usage:</strong> ${Math.floor(limit * (percent/100))} / ${limit} messages</p>
        <p style="margin: 5px 0;"><strong>Remaining:</strong> ${limit - Math.floor(limit * (percent/100))} messages</p>
      </div>
      <p>${percent >= 100 ? "You have reached your limit. Please upgrade your plan to continue using AI services." : "Consider upgrading your plan to avoid any service interruption."}</p>
      <a href="https://driplare.com/dashboard/payment" style="display: inline-block; padding: 10px 20px; background-color: #6d28d9; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Upgrade Plan</a>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">&copy; 2026 Driplare AI. All rights reserved.</p>
    </div>
  `,

  securityAlert: (name: string, event: string, details: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #dc2626;">Security Alert: ${event}</h2>
      <p>Hello ${name},</p>
      <p>This is a security notification regarding your account. A significant activity was detected:</p>
      <div style="background-color: #fef2f2; padding: 15px; border: 1px solid #fee2e2; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Activity:</strong> ${event}</p>
        <p style="margin: 5px 0;"><strong>Details:</strong> ${details}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>
      <p>If this was you, you can safely ignore this email. If you don't recognize this activity, please reset your password immediately and secure your account.</p>
      <a href="https://driplare.com/dashboard/settings" style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Secure Account</a>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">&copy; 2026 Driplare AI. All rights reserved.</p>
    </div>
  `,

  productUpdate: (name: string, title: string, content: string, linkLabel: string, linkUrl: string) => `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #6d28d9;">${title}</h2>
      <p>Hello ${name},</p>
      <p>${content}</p>
      <a href="${linkUrl}" style="display: inline-block; padding: 10px 20px; background-color: #6d28d9; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">${linkLabel}</a>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 11px; color: #999;">You received this email because you're subscribed to Product Updates. You can unsubscribe anytime in your account settings.</p>
      <p style="font-size: 12px; color: #666;">&copy; 2026 Driplare AI. All rights reserved.</p>
    </div>
  `,
};
