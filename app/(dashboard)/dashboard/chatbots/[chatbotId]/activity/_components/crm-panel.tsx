"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  User,
  Tag,
  FileText,
  ShoppingBag,
  Sparkles,
  Phone,
  Globe,
  Plus,
  Package,
  MapPin,
  Hash,
  CheckCircle2,
  Image as ImageIcon,
  ExternalLink,
  ListTodo,
} from "lucide-react";
import { LeadStatusBadge, LeadStatus } from "./lead-status-badge";

interface CrmPanelProps {
  session: {
    sessionId: string;
    title: string;
    platform: string;
    profilePhoto?: string | null;
    leadStatus?: string;
  } | null;
  messages: any[];
  onUpdateLeadStatus: (sessionId: string, status: LeadStatus) => void;
}

function Section({
  icon: Icon,
  title,
  badgeText,
  rightAction,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  badgeText?: string | number;
  rightAction?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/40 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[12.5px] font-semibold text-foreground">{title}</span>
          {badgeText !== undefined && (
            <span className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded-full text-[10px] font-semibold">
              {badgeText}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {rightAction}
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 py-3 bg-card/40 border-t border-border/40">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "high_prospect", label: "High Prospect" },
  { value: "priority",      label: "Priority"      },
  { value: "risky",         label: "Risky"         },
  { value: "successful",    label: "Successful"    },
  { value: "top_client",    label: "Top Client"    },
  { value: "none",          label: "None"          },
];

function QuickOrderForm({ customerName }: { customerName: string }) {
  const { t } = useTranslation("live-inbox");
  const [form, setForm] = useState({
    name: customerName,
    phone: "",
    address: "",
    product: "",
    quantity: "1",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const field = (
    key: keyof typeof form,
    placeholder: string,
    icon: React.ElementType,
    type = "text"
  ) => {
    const Icon = icon;
    return (
      <div className="relative">
        <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        <input
          type={type}
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className="w-full pl-7 pr-2.5 py-1.5 bg-muted/50 border border-border/50 rounded-lg text-[11.5px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {field("name",     t("crm.orderForm.customerName"), User)}
      {field("phone",    t("crm.orderForm.phone"),        Phone, "tel")}
      {field("address",  t("crm.orderForm.address"),      MapPin)}
      {field("product",  t("crm.orderForm.product"),      Package)}
      {field("quantity", t("crm.orderForm.quantity"),     Hash, "number")}

      <textarea
        placeholder={t("crm.orderForm.notes")}
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        rows={2}
        className="w-full px-2.5 py-1.5 bg-muted/50 border border-border/50 rounded-lg text-[11.5px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
      />

      <button
        type="submit"
        disabled={submitting || !form.name}
        className="w-full py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[11.5px] font-semibold shadow-xs disabled:opacity-50 transition-opacity"
      >
        {submitting ? t("crm.orderForm.submitting") : submitted ? "✓ Order Created!" : t("crm.orderForm.submit")}
      </button>
    </form>
  );
}

export function CrmPanel({ session, messages, onUpdateLeadStatus }: CrmPanelProps) {
  const { t } = useTranslation("live-inbox");
  const [notes, setNotes] = useState("");
  const [showOrderModal, setShowOrderModal] = useState(false);

  if (!session) {
    return (
      <div className="w-[300px] shrink-0 flex flex-col items-center justify-center h-full bg-card border border-border/60 rounded-xl shadow-xs text-muted-foreground">
        <User className="w-8 h-8 opacity-20 mb-2" />
        <p className="text-[12px]">{t("conversation.selectPrompt")}</p>
      </div>
    );
  }

  const lastMessages = messages.slice(-4);
  const aiSummary =
    lastMessages.length > 0
      ? lastMessages
          .filter((m) => m.role === "assistant")
          .map((m) => m.content.slice(0, 60))
          .join(" … ")
          .slice(0, 160) || null
      : null;

  return (
    <div className="w-[300px] shrink-0 flex flex-col h-full bg-card border border-border/60 rounded-xl shadow-xs overflow-hidden">
      
      {/* ── Order Actions Top Header ── */}
      <div className="p-3 border-b border-border/50 bg-card shrink-0 space-y-2">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          {t("crm.orderActions")}
        </span>
        
        {/* Two Prominent Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowOrderModal((v) => !v)}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-[12px] font-semibold text-foreground transition-all shadow-xs"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-primary" />
            <span>{t("crm.manageOrders")}</span>
          </button>

          <button
            onClick={() => setShowOrderModal((v) => !v)}
            className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[12px] font-semibold transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("crm.createOrders")}</span>
          </button>
        </div>
      </div>

      {/* ── Scrollable CRM Details Accordions ── */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-thumb-border/40">
        
        {/* Quick Order Creation Form Popup / Expand */}
        {showOrderModal && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-muted/40 border border-primary/30 rounded-xl"
          >
            <QuickOrderForm customerName={session.title} />
          </motion.div>
        )}

        {/* 1. Contact Details */}
        <Section icon={User} title={t("crm.title")} defaultOpen>
          <div className="space-y-2 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("crm.name")}:</span>
              <span className="font-medium text-foreground">{session.title}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("crm.platform")}:</span>
              <span className="font-medium text-foreground capitalize">{session.platform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("crm.phone")}:</span>
              <span className="font-medium text-foreground">+880 1894-927244</span>
            </div>
          </div>
        </Section>

        {/* 2. Tags with + Add New */}
        <Section
          icon={Tag}
          title={t("crm.tags")}
          rightAction={
            <span className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer">
              <Plus className="w-3 h-3" />
              {t("crm.addTag")}
            </span>
          }
          defaultOpen
        >
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <LeadStatusBadge status={session.leadStatus ?? "priority"} />
              <LeadStatusBadge status="top_client" />
              <LeadStatusBadge status="high_prospect" />
            </div>

            <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-1">
              {LEAD_STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onUpdateLeadStatus(session.sessionId, value)}
                  className={`px-2 py-1 rounded text-[10.5px] font-medium text-left transition-colors ${
                    session.leadStatus === value
                      ? "bg-primary/20 text-primary font-bold"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* 3. Notes for the customer (with badge count 69) */}
        <Section icon={FileText} title={t("crm.notes")} badgeText={69} defaultOpen={false}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("crm.notesPlaceholder")}
            rows={3}
            className="w-full px-2.5 py-1.5 bg-muted/50 border border-border/50 rounded-lg text-[11.5px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
          />
        </Section>

        {/* 4. Conversation Summary */}
        <Section icon={Sparkles} title={t("crm.aiSummary")} defaultOpen={false}>
          {aiSummary ? (
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              {aiSummary}…
            </p>
          ) : (
            <p className="text-[11.5px] text-muted-foreground italic">
              {t("crm.noSummary")}
            </p>
          )}
        </Section>

        {/* 5. Activity List (Timeline Checklist) */}
        <Section
          icon={ListTodo}
          title={t("crm.activityList")}
          rightAction={
            <span className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-0.5">
              {t("crm.seeAll")}
              <ExternalLink className="w-2.5 h-2.5" />
            </span>
          }
          defaultOpen={false}
        >
          <div className="space-y-2 text-[11.5px]">
            {[
              "Your details confirmed",
              "Company details updated",
              "Invite team members",
              "Social channels linked",
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. Shared Files (Image Gallery Grid) */}
        <Section
          icon={ImageIcon}
          title={t("crm.sharedFiles")}
          rightAction={
            <span className="text-[11px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-0.5">
              {t("crm.seeAll")}
              <ExternalLink className="w-2.5 h-2.5" />
            </span>
          }
          defaultOpen={false}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="aspect-square bg-muted/60 border border-border/40 rounded-lg flex items-center justify-center overflow-hidden hover:opacity-80 cursor-pointer transition-opacity"
              >
                <ImageIcon className="w-4 h-4 opacity-40 text-muted-foreground" />
              </div>
            ))}
          </div>
        </Section>

      </div>
    </div>
  );
}
