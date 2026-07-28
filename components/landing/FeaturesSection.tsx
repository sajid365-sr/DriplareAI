"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Layers, Globe, Brain, BarChart3, Headset, Code2, Sparkles } from "lucide-react";

export default function FeaturesSection() {
  const { t } = useTranslation("home");

  const featureItems = [
    { key: "train", icon: Layers, gradient: "from-blue-500/20 to-indigo-500/20", iconColor: "text-blue-500" },
    { key: "channels", icon: Globe, gradient: "from-emerald-500/20 to-teal-500/20", iconColor: "text-emerald-500" },
    { key: "models", icon: Brain, gradient: "from-violet-500/20 to-purple-500/20", iconColor: "text-violet-500" },
    { key: "analytics", icon: BarChart3, gradient: "from-amber-500/20 to-orange-500/20", iconColor: "text-amber-500" },
    { key: "live", icon: Headset, gradient: "from-rose-500/20 to-pink-500/20", iconColor: "text-rose-500" },
    { key: "api", icon: Code2, gradient: "from-cyan-500/20 to-blue-500/20", iconColor: "text-cyan-500" },
  ];

  return (
    <section id="features" className="py-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("features.badge")}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight"
          >
            {t("features.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground"
          >
            {t("features.subtitle")}
          </motion.p>
        </div>

        {/* Feature Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="group relative p-7 rounded-3xl border border-border/80 bg-card hover:bg-card/90 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center ${item.iconColor} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xl mb-2 text-foreground">
                    {t(`features.items.${item.key}.t`)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`features.items.${item.key}.d`)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
