"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, Info, Shield, CreditCard, Sparkles, Zap, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface NotificationSettings {
  usage_alerts_email: boolean;
  usage_alerts_app: boolean;
  billing_email: boolean;
  billing_app: boolean;
  security_email: boolean;
  security_app: boolean;
  product_email: boolean;
  product_app: boolean;
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const { t } = useTranslation("settings");

  useEffect(() => {
    fetch("/api/user/settings/notifications")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
      })
      .catch(() => toast.error(t("notifications.error", "Failed to load settings")))
      .finally(() => setLoading(false));
  }, []);

  const toggleSetting = async (key: keyof NotificationSettings) => {
    if (!settings) return;

    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };
    
    // Optimistic update
    setSettings(newSettings);

    try {
      const res = await fetch("/api/user/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!res.ok) throw new Error();
      toast.success(t("notifications.success", "Settings updated"));
    } catch (error) {
      // Revert on error
      setSettings(settings);
      toast.error(t("notifications.error", "Failed to update settings"));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-sm">{t("notifications.loading", "Loading notification preferences...")}</p>
      </div>
    );
  }

  const categories = [
    {
      id: "usage",
      title: t("notifications.categories.usage.title", "Usage Alerts"),
      description: t("notifications.categories.usage.desc", "Stay informed about your message quota and usage limits."),
      icon: Zap,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      settings: [
        { key: "usage_alerts_email", label: t("notifications.settings.usage_alerts_email.label", "Email Notifications"), description: t("notifications.settings.usage_alerts_email.desc", "Receive alerts when you reach 80% and 100% of your limit."), channel: "email" },
        { key: "usage_alerts_app", label: t("notifications.settings.usage_alerts_app.label", "In-App Alerts"), description: t("notifications.settings.usage_alerts_app.desc", "Real-time dashboard notifications for usage warnings."), channel: "app" },
      ]
    },
    {
      id: "billing",
      title: t("notifications.categories.billing.title", "Billing & Subscription"),
      description: t("notifications.categories.billing.desc", "Manage notifications for invoices, payments, and plan changes."),
      icon: CreditCard,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      settings: [
        { key: "billing_email", label: t("notifications.settings.billing_email.label", "Email Invoices"), description: t("notifications.settings.billing_email.desc", "Monthly invoices sent directly to your inbox."), channel: "email" },
        { key: "billing_app", label: t("notifications.settings.billing_app.label", "Payment Alerts"), description: t("notifications.settings.billing_app.desc", "In-app notifications for successful or failed payments."), channel: "app" },
      ]
    },
    {
      id: "security",
      title: t("notifications.categories.security.title", "Security & Account"),
      description: t("notifications.categories.security.desc", "Keep your account safe with critical security notifications."),
      icon: Shield,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      settings: [
        { key: "security_email", label: t("notifications.settings.security_email.label", "Login Alerts"), description: t("notifications.settings.security_email.desc", "Notifications for new logins from unrecognized devices."), channel: "email" },
        { key: "security_app", label: t("notifications.settings.security_app.label", "Security Updates"), description: t("notifications.settings.security_app.desc", "Alerts for password changes and security settings."), channel: "app" },
      ]
    },
    {
      id: "product",
      title: t("notifications.categories.product.title", "Product Updates"),
      description: t("notifications.categories.product.desc", "Be the first to know about new features and improvements."),
      icon: Sparkles,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      settings: [
        { key: "product_email", label: t("notifications.settings.product_email.label", "Newsletters"), description: t("notifications.settings.product_email.desc", "Weekly roundup of new AI features and platform tips."), channel: "email" },
        { key: "product_app", label: t("notifications.settings.product_app.label", "What's New"), description: t("notifications.settings.product_app.desc", "Visual indicators for major product updates."), channel: "app" },
      ]
    }
  ];

  return (
    <div className="space-y-8 pb-10 max-w-4xl">
      <div className="grid gap-6">
        {categories.map((category, idx) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative overflow-hidden p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-2.5 rounded-xl ${category.bgColor} ${category.color}`}>
                    <category.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{category.title}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {category.settings.map((s) => (
                    <div key={s.key} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/50 group/item hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {s.channel === "email" ? (
                            <Mail className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                          ) : (
                            <Bell className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{s.label}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed max-w-[400px]">{s.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={settings?.[s.key as keyof NotificationSettings] || false}
                        onCheckedChange={() => toggleSetting(s.key as keyof NotificationSettings)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info Box */}
      <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-start gap-4">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-primary/80 leading-relaxed italic">
          <strong>Note:</strong> {t("notifications.infoBox", "Critical system notifications (like password resets) cannot be disabled. Some email notifications may take up to 24 hours to reflect changes.")}
        </div>
      </div>
    </div>
  );
}
