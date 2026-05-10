import { db } from "@/lib/db";
import { sendMail, MailTemplates } from "@/lib/mail";

/**
 * Service to handle higher-level notification logic across the app.
 */
export const NotificationsService = {
  /**
   * Broadcast a product update to all users who have 'product_email' or 'product_app' enabled.
   */
  async broadcastProductUpdate({ 
    title, 
    content, 
    linkLabel, 
    linkUrl 
  }: { 
    title: string; 
    content: string; 
    linkLabel: string; 
    linkUrl: string;
  }) {
    console.log(`[BROADCAST] Starting product update: ${title}`);
    
    // Fetch all users
    const users = await db.user.findMany({
      select: {
        userId: true,
        email: true,
        name: true,
        notificationSettings: true,
      }
    });

    const results = { emailSent: 0, appNotifCreated: 0, total: users.length };

    for (const user of users) {
      const settings = (user.notificationSettings as any) || {};

      // 1. In-App Notification
      if (settings.product_app !== false) {
        await db.notification.create({
          data: {
            userId: user.userId,
            type: "product",
            title,
            message: content.slice(0, 150) + (content.length > 150 ? "..." : ""),
          }
        }).catch(err => console.error(`Failed app notif for ${user.email}`, err));
        results.appNotifCreated++;
      }

      // 2. Email Notification
      if (settings.product_email !== false) { 
        await sendMail({
          to: user.email,
          subject: `What's New: ${title} - Driplare AI`,
          html: MailTemplates.productUpdate(
            user.name || "User",
            title,
            content,
            linkLabel,
            linkUrl
          )
        }).catch(err => console.error(`Failed email for ${user.email}`, err));
        results.emailSent++;
      }
    }

    console.log(`[BROADCAST] Finished. Results:`, results);
    return results;
  }
};
