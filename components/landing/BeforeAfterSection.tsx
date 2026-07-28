"use client";

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { XCircle, CheckCircle2, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";

export default function BeforeAfterSection() {
  const { t } = useTranslation("home");

  const beforeItems = [
    t("beforeAfter.before.item1"),
    t("beforeAfter.before.item2"),
    t("beforeAfter.before.item3"),
    t("beforeAfter.before.item4"),
    t("beforeAfter.before.item5"),
  ];

  const afterItems = [
    t("beforeAfter.after.item1"),
    t("beforeAfter.after.item2"),
    t("beforeAfter.after.item3"),
    t("beforeAfter.after.item4"),
    t("beforeAfter.after.item5"),
  ];

  return (
    <section id="before-after" className="py-24 relative overflow-hidden">
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
            {t("beforeAfter.badge")}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight"
          >
            {t("beforeAfter.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground"
          >
            {t("beforeAfter.subtitle")}
          </motion.p>
        </div>

        {/* Side-by-Side Comparison Cards */}
        <div className="grid md:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto">
          {/* Before Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-8 flex flex-col justify-between shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-rose-500/20 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xl text-rose-600 dark:text-rose-400">
                    {t("beforeAfter.before.title")}
                  </h3>
                </div>
              </div>

              <ul className="space-y-4 text-sm text-muted-foreground">
                {beforeItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* After Card (Highlighted) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 via-card to-card p-8 flex flex-col justify-between shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 px-4 py-1 bg-emerald-500 text-white font-medium text-xs rounded-bl-2xl">
              Recommended Solution
            </div>

            <div>
              <div className="flex items-center justify-between pb-6 border-b border-emerald-500/20 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-xl text-emerald-600 dark:text-emerald-400">
                    {t("beforeAfter.after.title")}
                  </h3>
                </div>
              </div>

              <ul className="space-y-4 text-sm font-medium text-foreground">
                {afterItems.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
