"use client";

import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShoppingCart, FileSpreadsheet, Truck, CheckCircle2,
  ExternalLink, Save, ChevronDown, ChevronUp, Info, Loader2, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ----- Types -----
interface EcommerceConfig {
  productSheetUrl: string;
  orderSheetUrl: string;
  productSheetName: string;
  orderSheetName: string;
  steadfastEnabled: boolean;
  steadfastApiKey: string;
  steadfastSecretKey: string;
  pathaoEnabled: boolean;
  pathaoClientId: string;
  pathaoClientSecret: string;
  pathaoMerchantId: string;
}

const DEFAULT_CONFIG: EcommerceConfig = {
  productSheetUrl: "",
  orderSheetUrl: "",
  productSheetName: "Products",
  orderSheetName: "Orders",
  steadfastEnabled: false,
  steadfastApiKey: "",
  steadfastSecretKey: "",
  pathaoEnabled: false,
  pathaoClientId: "",
  pathaoClientSecret: "",
  pathaoMerchantId: "",
};

// ----- Small sub-components -----

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function InputField({
  label, value, onChange, placeholder, type = "text", hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Toggle({ enabled, onToggle, label, description }: {
  enabled: boolean; onToggle: () => void; label: string; description: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${enabled ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${enabled ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

function CourierCard({
  logo, name, tagline, enabled, onToggle, children, accentColor
}: {
  logo: React.ReactNode; name: string; tagline: string;
  enabled: boolean; onToggle: () => void; children: React.ReactNode; accentColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden ${enabled ? `border-primary/40 bg-primary/5` : "border-border bg-card"}`}
    >
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm`} style={{ backgroundColor: accentColor }}>
              {logo}
            </div>
            <div>
              <p className="font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {enabled && (
              <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            )}
            <button
              onClick={onToggle}
              className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Credentials */}
      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border"
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>API Credentials</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expanded && (
            <div className="px-5 pb-5 space-y-4">
              {children}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ----- Main Page -----

export default function EcommercePage() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const { t, i18n } = useTranslation("chatbots");
  const isBn = i18n.language === "bn";

  const [config, setConfig] = useState<EcommerceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing config
  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}/e-commerce`)
      .then((r) => r.json())
      .then((data) => {
        if (data.config) {
          setConfig({ ...DEFAULT_CONFIG, ...data.config });
        }
      })
      .catch(() => toast.error("Failed to load config"))
      .finally(() => setLoading(false));
  }, [chatbotId]);

  const patch = (key: keyof EcommerceConfig, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/e-commerce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!r.ok) throw new Error("Save failed");
      toast.success(isBn ? "সেটিংস সেভ হয়েছে!" : "Settings saved successfully!");
    } catch {
      toast.error(isBn ? "সেভ করতে সমস্যা হয়েছে" : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-10 pb-20">
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">
                {isBn ? "ই-কমার্স সেটিংস" : "E-Commerce Settings"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isBn
                ? "আপনার প্রোডাক্ট শিট, অর্ডার ম্যানেজমেন্ট এবং ডেলিভারি কুরিয়ার এক জায়গায় সেটআপ করুন।"
                : "Set up your product sheet, order management, and delivery couriers all in one place."}
            </p>
          </div>
          <Button onClick={save} disabled={saving} className="gap-2 shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isBn ? "সেভ করুন" : "Save"}
          </Button>
        </div>
      </motion.div>

      {/* ──── SECTION 1: Google Sheets ──── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-6 space-y-6"
      >
        <SectionHeader
          icon={FileSpreadsheet}
          title={isBn ? "গুগল শিট সংযোগ" : "Google Sheets Connection"}
          subtitle={
            isBn
              ? "আপনার প্রোডাক্ট লিস্ট এবং অর্ডার কনফার্মেশনের জন্য আলাদা শিটের লিংক দিন।"
              : "Connect your product list and order confirmation sheets."
          }
        />

        {/* Live data explainer banner */}
        <div className="flex gap-3 rounded-xl bg-primary/8 border border-primary/20 p-4">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-primary/90 leading-relaxed">
            {isBn
              ? "আপনি শুধু আপনার গুগল শিটে প্রোডাক্ট আপডেট করুন — AI স্বয়ংক্রিয়ভাবে রিয়েল-টাইম ডেটা পড়ে নেবে। বারবার সিঙ্ক করার কোনো ঝামেলা নেই!"
              : "Just update your Google Sheet — the AI will automatically read live data every time. No manual syncing required!"}
          </p>
        </div>

        <div className="space-y-4">
          {/* Product Sheet */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">{isBn ? "প্রোডাক্ট শিট" : "Product Sheet"}</span>
            </div>
            <InputField
              label={isBn ? "Google Sheets লিংক" : "Google Sheets URL"}
              value={config.productSheetUrl}
              onChange={(v) => patch("productSheetUrl", v)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              hint={isBn
                ? "শিটটি যে কেউ লিংক দিয়ে দেখতে পারবে এমন করে শেয়ার করুন (Viewer access)।"
                : "Make sure the sheet is shared with 'Anyone with the link can view'."}
            />
            <InputField
              label={isBn ? "শিট ট্যাবের নাম" : "Sheet Tab Name"}
              value={config.productSheetName}
              onChange={(v) => patch("productSheetName", v)}
              placeholder="Products"
            />
            {config.productSheetUrl && (
              <a
                href={config.productSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {isBn ? "শিট দেখুন" : "View Sheet"}
              </a>
            )}
          </div>

          {/* Order Sheet */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold">{isBn ? "অর্ডার কনফার্মেশন শিট" : "Order Confirmation Sheet"}</span>
            </div>
            <InputField
              label={isBn ? "Google Sheets লিংক" : "Google Sheets URL"}
              value={config.orderSheetUrl}
              onChange={(v) => patch("orderSheetUrl", v)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              hint={isBn
                ? "কাস্টমার অর্ডার কনফার্ম করলে AI স্বয়ংক্রিয়ভাবে এই শিটে নতুন সারি যোগ করবে।"
                : "When a customer confirms an order, the AI will automatically add a new row to this sheet."}
            />
            <InputField
              label={isBn ? "শিট ট্যাবের নাম" : "Sheet Tab Name"}
              value={config.orderSheetName}
              onChange={(v) => patch("orderSheetName", v)}
              placeholder="Orders"
            />
            {config.orderSheetUrl && (
              <a
                href={config.orderSheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {isBn ? "শিট দেখুন" : "View Sheet"}
              </a>
            )}
          </div>
        </div>
      </motion.div>

      {/* ──── SECTION 2: Courier Services ──── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <SectionHeader
          icon={Truck}
          title={isBn ? "ডেলিভারি কুরিয়ার" : "Delivery Couriers"}
          subtitle={
            isBn
              ? "আপনার ডেলিভারি পার্টনার চালু করুন। AI স্বয়ংক্রিয়ভাবে অর্ডার তৈরি করবে।"
              : "Enable your delivery partner. The AI will automatically create orders upon confirmation."
          }
        />

        {/* SteadFast */}
        <CourierCard
          name="SteadFast Courier"
          tagline={isBn ? "বাংলাদেশের জনপ্রিয় ডেলিভারি সার্ভিস" : "Popular delivery service in Bangladesh"}
          logo="SF"
          enabled={config.steadfastEnabled}
          onToggle={() => patch("steadfastEnabled", !config.steadfastEnabled)}
          accentColor="#00a651"
        >
          <InputField
            label="API Key"
            value={config.steadfastApiKey}
            onChange={(v) => patch("steadfastApiKey", v)}
            placeholder="6mdxclldes8srhxk..."
            type="password"
            hint={isBn ? "SteadFast পোর্টাল থেকে API Key নিন।" : "Get your API Key from the SteadFast portal."}
          />
          <InputField
            label="Secret Key"
            value={config.steadfastSecretKey}
            onChange={(v) => patch("steadfastSecretKey", v)}
            placeholder="cismnutw64qpnrte..."
            type="password"
          />
          <a
            href="https://portal.packzy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            {isBn ? "SteadFast পোর্টাল খুলুন" : "Open SteadFast Portal"}
          </a>
        </CourierCard>

        {/* Pathao */}
        <CourierCard
          name="Pathao Courier"
          tagline={isBn ? "দ্রুত ও নির্ভরযোগ্য ডেলিভারি সার্ভিস" : "Fast and reliable delivery service"}
          logo="P"
          enabled={config.pathaoEnabled}
          onToggle={() => patch("pathaoEnabled", !config.pathaoEnabled)}
          accentColor="#e8192c"
        >
          <InputField
            label="Client ID"
            value={config.pathaoClientId}
            onChange={(v) => patch("pathaoClientId", v)}
            placeholder="Your Pathao Client ID"
          />
          <InputField
            label="Client Secret"
            value={config.pathaoClientSecret}
            onChange={(v) => patch("pathaoClientSecret", v)}
            placeholder="Your Pathao Client Secret"
            type="password"
          />
          <InputField
            label="Merchant ID"
            value={config.pathaoMerchantId}
            onChange={(v) => patch("pathaoMerchantId", v)}
            placeholder="Your Pathao Merchant ID"
          />
          <a
            href="https://pathao.com/bn/blog/api-merchant-auto-address-feature/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            {isBn ? "Pathao API ডকুমেন্টেশন" : "Pathao API Documentation"}
          </a>
        </CourierCard>
      </motion.div>

      {/* Floating Save Button (mobile) */}
      <div className="fixed bottom-6 right-6 md:hidden z-40">
        <Button onClick={save} disabled={saving} size="lg" className="rounded-full shadow-xl gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isBn ? "সেভ" : "Save"}
        </Button>
      </div>
    </div>
  );
}
