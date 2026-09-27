"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, Sparkles } from "lucide-react";

export default function FAQSection() {
  const { t } = useTranslation("home");
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqItems = [
    { q: t("faq.q1.q"), a: t("faq.q1.a") },
    { q: t("faq.q2.q"), a: t("faq.q2.a") },
    { q: t("faq.q3.q"), a: t("faq.q3.a") },
    { q: t("faq.q4.q"), a: t("faq.q4.a") },
    { q: t("faq.q5.q"), a: t("faq.q5.a") },
  ];

  const toggleAccordion = (index: number) => {
    setOpenIdx(openIdx === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 relative overflow-hidden">
      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("faq.badge")}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight"
          >
            {t("faq.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground"
          >
            {t("faq.subtitle")}
          </motion.p>
        </div>

        {/* Accordion List */}
        <div className="space-y-4 max-w-3xl mx-auto">
          {faqItems.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={`rounded-2xl border border-border/80 bg-card overflow-hidden transition-all duration-200 ${
                  isOpen ? "shadow-md border-primary/40" : "hover:border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left font-semibold text-base sm:text-lg gap-4"
                >
                  <span className="flex items-center gap-3 text-foreground">
                    <HelpCircle className="w-5 h-5 text-primary shrink-0" />
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-5 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/40 ml-8">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
