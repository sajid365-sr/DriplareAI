"use client";

import { useEffect, useState } from "react";
import { Bell, Mail, Info, Shield, CreditCard, Sparkles, Zap, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { motion } from "framer-motion";

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

  useEffect(() => {
    fetch("/api/user/settings/notifications")
      .then((res) => res.json())
      .then((data) => {
        setSettings(data);
      })
      .catch(() => toast.error("Failed to load settings"))
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
      toast.success("Settings updated");
    } catch (error) {
      // Revert on error
      setSettings(settings);
      toast.error("Failed to update settings");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse text-sm">Loading notification preferences...</p>
      </div>
    );
  }

  const categories = [
    {
      id: "usage",
      title: "Usage Alerts",
      description: "Stay informed about your message quota and usage limits.",
      icon: Zap,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      settings: [
        { key: "usage_alerts_email", label: "Email Notifications", description: "Receive alerts when you reach 80% and 100% of your limit.", channel: "email" },
        { key: "usage_alerts_app", label: "In-App Alerts", description: "Real-time dashboard notifications for usage warnings.", channel: "app" },
      ]
    },
    {
      id: "billing",
      title: "Billing & Subscription",
      description: "Manage notifications for invoices, payments, and plan changes.",
      icon: CreditCard,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      settings: [
        { key: "billing_email", label: "Email Invoices", description: "Monthly invoices sent directly to your inbox.", channel: "email" },
        { key: "billing_app", label: "Payment Alerts", description: "In-app notifications for successful or failed payments.", channel: "app" },
      ]
    },
    {
      id: "security",
      title: "Security & Account",
      description: "Keep your account safe with critical security notifications.",
      icon: Shield,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      settings: [
        { key: "security_email", label: "Login Alerts", description: "Notifications for new logins from unrecognized devices.", channel: "email" },
        { key: "security_app", label: "Security Updates", description: "Alerts for password changes and security settings.", channel: "app" },
      ]
    },
    {
      id: "product",
      title: "Product Updates",
      description: "Be the first to know about new features and improvements.",
      icon: Sparkles,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      settings: [
        { key: "product_email", label: "Newsletters", description: "Weekly roundup of new AI features and platform tips.", channel: "email" },
        { key: "product_app", label: "What's New", description: "Visual indicators for major product updates.", channel: "app" },
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
          <strong>Note:</strong> Critical system notifications (like password resets) cannot be disabled. 
          Some email notifications may take up to 24 hours to reflect changes.
        </div>
      </div>
    </div>
  );
}
