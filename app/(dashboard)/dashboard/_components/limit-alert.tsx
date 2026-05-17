"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpCircle } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

export function LimitAlert() {
  const [status, setStatus] = useState<any>(null);
  const { i18n } = useTranslation();
  const isBn = i18n.language === "bn";

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then(data => {
        // Here we can check if chatbots or integrations exceed limits
        // Based on the data structure returned by /api/usage
        // For simplicity, let's assume /api/usage provides these counts
        setStatus(data);
      })
      .catch(() => {});
  }, []);

  if (!status) return null;

  const isExceeded = 
    (status.ai?.totalChatbots > status.includedChatbots) || 
    (status.totalIntegrations > status.maxIntegrations);

  if (!isExceeded) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3"
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-amber-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-amber-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="text-sm font-medium">
              <span className="font-bold">
                {isBn ? "প্ল্যান লিমিট অতিক্রম হয়েছে!" : "Plan Limit Exceeded!"}
              </span>
              <p className="text-[11px] opacity-80">
                {isBn 
                  ? `আপনার বর্তমান প্ল্যানে ${status.includedChatbots}টি চ্যাটবট অনুমোদিত, কিন্তু আপনার ${status.ai?.totalChatbots}টি আছে। কিছু চ্যাটবট ডিজেবল করা হতে পারে।`
                  : `Your plan allows ${status.includedChatbots} chatbots, but you have ${status.ai?.totalChatbots}. Some features may be disabled.`}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/payment"
            className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20 shrink-0"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            {isBn ? "এখনই আপগ্রেড করুন" : "Upgrade Now"}
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
