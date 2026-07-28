"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { MessageSquare, Globe, Sparkles, Send, Check } from "lucide-react";

export default function ChannelsSection() {
  const { t } = useTranslation("home");

  const channels = [
    {
      name: "Facebook Messenger",
      badge: "Facebook",
      bgColor: "bg-[#1877F2]/10",
      textColor: "text-[#1877F2]",
      borderColor: "border-[#1877F2]/30",
      icon: MessageSquare,
    },
    {
      name: "WhatsApp Business",
      badge: "WhatsApp",
      bgColor: "bg-[#25D366]/10",
      textColor: "text-[#25D366]",
      borderColor: "border-[#25D366]/30",
      icon: MessageSquare,
    },
    {
      name: "Instagram Direct",
      badge: "Instagram",
      bgColor: "bg-gradient-to-r from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F56040]/10",
      textColor: "text-[#E1306C]",
      borderColor: "border-[#E1306C]/30",
      icon: Globe,
    },
    {
      name: "Telegram Bot",
      badge: "Telegram",
      bgColor: "bg-[#229ED9]/10",
      textColor: "text-[#229ED9]",
      borderColor: "border-[#229ED9]/30",
      icon: Send,
    },
    {
      name: "Website Live Chat",
      badge: "Web Embed",
      bgColor: "bg-primary/10",
      textColor: "text-primary",
      borderColor: "border-primary/30",
      icon: MessageSquare,
    },
  ];

  return (
    <section id="channels" className="py-20 bg-muted/40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("channels.badge")}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight"
          >
            {t("channels.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground"
          >
            {t("channels.subtitle")}
          </motion.p>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {channels.map((ch, idx) => {
            const Icon = ch.icon;
            return (
              <motion.div
                key={ch.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className={`p-6 rounded-3xl border ${ch.borderColor} ${ch.bgColor} backdrop-blur-md flex flex-col items-center justify-center text-center group hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-xl`}
              >
                <div className={`w-14 h-14 rounded-2xl bg-background flex items-center justify-center ${ch.textColor} shadow-md mb-3 group-hover:rotate-6 transition-transform duration-300`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div className="font-bold text-base text-foreground mb-1">{ch.name}</div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                  <Check className="w-3 h-3 text-emerald-500" /> Supported
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
