"use client";

import { AuthenticationCard } from "./_components/AuthenticationCard";
import { DataExportCard } from "./_components/DataExportCard";
import { DataRetentionCard } from "./_components/DataRetentionCard";
import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function SecurityPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-8 w-full pb-10">
      {/* Page Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          {t("security.title", "Security & Data Management")}
        </h2>
        <p className="text-base text-muted-foreground">
          {t("security.subtitle", "Manage your account security, authentication methods, and personal data settings.")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Authentication Section */}
        <AuthenticationCard />

        {/* Data Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DataExportCard />
          <DataRetentionCard />
        </div>

        {/* Privacy Note */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl border border-border bg-muted/30 flex gap-4 items-center"
        >
          <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0 shadow-sm border border-border">
            <ShieldAlert className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">{t("security.privacyTitle", "Your Privacy Matters")}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t("security.privacyDesc", "We encrypt all your data at rest and in transit. Driplare AI employees cannot access your private knowledge base sources or chatbot conversation logs without your explicit permission.")}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
