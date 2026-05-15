import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";
import { sendMail, MailTemplates } from "@/lib/mail";

export async function POST() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all user related data comprehensively
    const userData = await db.user.findUnique({
      where: { userId: user.userId },
      include: {
        chatbots: {
          include: {
            integrations: true,
            sources: true,
            sessions: {
              take: 20,
              orderBy: { createdAt: "desc" }
            }
          }
        },
        aiUsageLogs: {
          take: 100,
          orderBy: { createdAt: "desc" }
        },
        referralsMade: {
          include: { referredUser: { select: { name: true, email: true } } }
        },
        payments: {
          orderBy: { createdAt: "desc" }
        }
      }
    });

    if (!userData) {
      return NextResponse.json({ error: "User data not found" }, { status: 404 });
    }

    // --- Rate Limiting: 72 Hours Cooldown ---
    const COOLDOWN_MS = 72 * 60 * 60 * 1000;
    if (userData.lastDataExportAt) {
      const diff = Date.now() - new Date(userData.lastDataExportAt).getTime();
      if (diff < COOLDOWN_MS) {
        const remainingHours = Math.ceil((COOLDOWN_MS - diff) / (60 * 60 * 1000));
        return NextResponse.json({ 
          error: `Rate limit reached. Please wait ${remainingHours} more hours before requesting another data export.` 
        }, { status: 429 });
      }
    }

    // Prepare a HIGHLY detailed export object
    const exportPayload = {
      reportInfo: {
        generatedAt: new Date().toISOString(),
        platform: "Driplare AI",
        version: "1.0"
      },
      account: {
        userId: userData.userId,
        name: userData.name,
        email: userData.email,
        plan: userData.plan,
        region: userData.region,
        dataRetentionPolicy: userData.dataRetention,
        joinedAt: userData.createdAt,
        updatedAt: userData.updatedAt,
        usageStats: {
          totalMessagesIncluded: userData.includedMessages,
          messagesUsedThisCycle: userData.messagesUsedThisCycle,
          billingCycleStart: userData.billingCycleStart,
          planExpiresAt: userData.planExpiresAt
        }
      },
      chatbots: userData.chatbots.map(bot => ({
        id: bot.chatbotId,
        name: bot.name,
        configuration: {
          model: bot.model,
          provider: bot.provider,
          temperature: bot.temperature,
          maxTokens: bot.maxTokens,
          systemPrompt: bot.systemPrompt,
          status: bot.status,
          avatarColor: bot.avatarColor
        },
        integrations: bot.integrations.map(i => ({
          platform: i.platform,
          connected: i.connected,
          status: i.status,
          config: i.config,
          connectedAt: i.connectedAt
        })),
        knowledgeBase: bot.sources.map(s => ({
          type: s.type,
          name: s.name,
          characters: s.charCount,
          addedAt: s.createdAt
        })),
        recentSessionsCount: bot.sessions.length
      })),
      referrals: {
        referralCode: userData.referralCode,
        totalReferrals: userData.referralsMade.length,
        history: userData.referralsMade.map(r => ({
          referredUser: r.referredUser.name,
          rewardPoints: r.rewardPoints,
          date: r.createdAt
        }))
      },
      billing: userData.payments.map(p => ({
        transactionId: p.sessionId,
        package: p.packageId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        date: p.createdAt,
        completedAt: p.completedAt
      })),
      recentActivityLogs: userData.aiUsageLogs.map(log => ({
        timestamp: log.createdAt,
        chatbotId: log.chatbotId,
        platform: log.platform,
        tokens: {
          prompt: log.promptTokens,
          completion: log.completionTokens,
          total: log.totalTokens
        },
        cost: {
          actualUSD: log.actualCostUSD,
          charged: log.chargedAmount,
          currency: log.chargedCurrency
        }
      }))
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);

    // Generate PDF Report using jsPDF
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    const primaryColor: [number, number, number] = [109, 40, 217]; // #6d28d9

    // --- Header ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("DRIPLARE AI", 15, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Complete Data Export Report", 15, 30);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 140, 30);

    // --- Account Overview ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Account Overview", 15, 55);
    
    autoTable(doc, {
      startY: 60,
      head: [["Field", "Details"]],
      body: [
        ["User Name", userData.name],
        ["Email", userData.email],
        ["User ID", userData.userId],
        ["Plan", userData.plan.toUpperCase()],
        ["Region", userData.region.toUpperCase()],
        ["Member Since", userData.createdAt.toLocaleDateString()],
        ["Retention Policy", userData.dataRetention],
        ["Messages (This Cycle)", `${userData.messagesUsedThisCycle} / ${userData.includedMessages}`],
      ],
      theme: "striped",
      headStyles: { fillColor: primaryColor },
    });

    // --- Chatbots ---
    doc.setFontSize(16);
    doc.text("Chatbots Configuration", 15, (doc as any).lastAutoTable.finalY + 15);
    
    const botData = userData.chatbots.map(bot => [
      bot.name,
      bot.model,
      bot.status,
      bot.sources.length,
      bot.integrations.filter(i => i.connected).map(i => i.platform).join(", ") || "None"
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Name", "Model", "Status", "Sources", "Integrations"]],
      body: botData,
      headStyles: { fillColor: primaryColor },
    });

    // --- Referrals ---
    if (userData.referralsMade.length > 0) {
      doc.setFontSize(16);
      doc.text("Referral History", 15, (doc as any).lastAutoTable.finalY + 15);
      
      const refData = userData.referralsMade.map(r => [
        r.referredUser.name,
        `${r.rewardPoints} pts`,
        r.createdAt.toLocaleDateString()
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Referred Friend", "Reward", "Date"]],
        body: refData,
        headStyles: { fillColor: primaryColor },
      });
    }

    // --- Billing ---
    if (userData.payments.length > 0) {
      doc.setFontSize(16);
      doc.text("Payment History", 15, (doc as any).lastAutoTable.finalY + 15);
      
      const payData = userData.payments.map(p => [
        p.createdAt.toLocaleDateString(),
        p.packageId,
        `${p.amount} ${p.currency}`,
        p.status
      ]);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Date", "Package", "Amount", "Status"]],
        body: payData,
        headStyles: { fillColor: primaryColor },
      });
    }

    // --- Usage Logs (Activity) ---
    doc.addPage();
    doc.setFontSize(16);
    doc.text("Recent Activity Log (Last 100)", 15, 20);
    
    const logData = userData.aiUsageLogs.map(log => [
      log.createdAt.toLocaleString(),
      log.chatbotId.substring(0, 8),
      log.platform,
      log.totalTokens,
      `${log.chargedAmount} ${log.chargedCurrency}`
    ]);

    autoTable(doc, {
      startY: 25,
      head: [["Timestamp", "Bot ID", "Platform", "Tokens", "Cost"]],
      body: logData,
      headStyles: { fillColor: primaryColor },
      styles: { fontSize: 8 }
    });

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Sanitize user name for filename (remove spaces and special chars)
    const sanitizedName = userData.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
    const pdfFileName = `Driplare-Data-Report-${sanitizedName}.pdf`;
    const jsonFileName = `Driplare-Full-Data-${sanitizedName}.json`;

    // Send the email with PDF and JSON
    const mailResult = await sendMail({
      to: userData.email,
      subject: "Driplare AI - Your Complete Data Report is Ready",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #6d28d9;">Driplare AI</h2>
          <p>Hello ${userData.name},</p>
          <p>Your requested personal data export is ready. We have attached a professional PDF report for easy viewing and a JSON file for your technical records.</p>
          <p>Please keep these files secure as they contain sensitive account information.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">&copy; 2026 Driplare AI. All rights reserved.</p>
        </div>
      `,
      attachments: [
        {
          filename: pdfFileName,
          content: pdfBuffer.toString("base64"),
        },
        {
          filename: jsonFileName,
          content: Buffer.from(jsonString).toString("base64"),
        }
      ]
    });

    if (!mailResult.success) {
      throw new Error("Failed to send email");
    }

    // Update the last export timestamp in DB
    await db.user.update({
      where: { userId: user.userId },
      data: { lastDataExportAt: new Date() }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Data export has been sent to your email." 
    });

  } catch (error) {
    console.error("[DATA_EXPORT_ERROR]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
