"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShoppingCart,
  FileSpreadsheet,
  Truck,
  CheckCircle2,
  ExternalLink,
  Save,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * এজেন্টের ই-কমার্স কনফিগারেশন — এখন Settings পেজের একটা সেকশন।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে এটা `/chatbots/[chatbotId]/e-commerce` নামে একটা **আলাদা রুট** ছিল,
 * অথচ প্রোডাক্টে কোথাও থেকে তার লিংক ছিল না — সাইডবারে নেই, সারির ⋯ মেনুতেও
 * নেই, শুধু URL জানলে তবে পৌঁছানো যেত। অর্থাৎ কার্যকরভাবে একটা লুকানো পেজ।
 *
 * এটা এজেন্টের *কনফিগারেশন*, তার সমগোত্রের আলাদা কিছু নয় — তাই আলাদা গন্তব্য
 * না রেখে Settings-এর ভেতরে আনা হলো (নাম, অ্যাভাটার, ডিলিটের পাশে)। API রুট
 * `/api/chatbots/[chatbotId]/e-commerce` অপরিবর্তিত — সেটা ডেটার ঠিকানা, আর
 * n8n-এর দিক থেকে দেখা জিনিস; শুধু UI-র ঠিকানা বদলেছে।
 *
 * দুটো সেভ বাটন থাকা ইচ্ছাকৃত: এই সেকশনের কনফিগ আর বাকি Settings পেজের নাম/
 * অ্যাভাটার **আলাদা resource** (`POST …/e-commerce` বনাম `PUT …/chatbots/[id]`)।
 * একটা বাটনে জোড়া লাগালে নাম বদলাতে গিয়ে কুরিয়ার key-ও আবার পাঠাতে হতো,
 * আর একটা ব্যর্থ হলে দুটোই ব্যর্থ দেখাত।
 */
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

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CourierCard({
  logo,
  name,
  tagline,
  enabled,
  onToggle,
  children,
  accentColor,
  activeLabel,
}: {
  logo: React.ReactNode;
  name: string;
  tagline: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  /** কুরিয়ারের নিজের ব্র্যান্ড রং — থিমের নয়, তাই টোকেন হবে না। */
  accentColor: string;
  activeLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      className={`overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
        enabled ? "border-primary/40 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {logo}
            </div>
            <div>
              <p className="font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">{tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {enabled && (
              <span className="hidden items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-medium text-success sm:flex">
                <CheckCircle2 className="h-3 w-3" /> {activeLabel}
              </span>
            )}
            <button
              onClick={onToggle}
              aria-pressed={enabled}
              className={`relative h-6 w-11 rounded-full transition-colors duration-300 ${
                enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-border"
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>API Credentials</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded && <div className="space-y-4 px-5 pb-5">{children}</div>}
        </motion.div>
      )}
    </motion.div>
  );
}

export function EcommerceSection({ chatbotId }: { chatbotId: string }) {
  const { t, i18n } = useTranslation("chatbots");
  const isBn = i18n.language === "bn";

  const [config, setConfig] = useState<EcommerceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}/e-commerce`)
      .then((r) => r.json())
      .then((data) => {
        if (data.config) setConfig({ ...DEFAULT_CONFIG, ...data.config });
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

  return (
    <section className="space-y-8" data-testid="ecommerce-section">
      {/* Section header + its own Save — see the note at the top of the file. */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">
            {t("ecommerce.title", "E-Commerce Settings")}
          </h2>
        </div>
        <Button
          onClick={save}
          disabled={saving || loading}
          className="shrink-0 gap-2"
          data-testid="ecommerce-save"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isBn ? "সেভ করুন" : "Save"}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {isBn
          ? "আপনার প্রোডাক্ট শিট, অর্ডার ম্যানেজমেন্ট এবং ডেলিভারি কুরিয়ার এক জায়গায় সেটআপ করুন।"
          : "Set up your product sheet, order management, and delivery couriers all in one place."}
      </p>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* ──── Google Sheets ──── */}
          <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
            <SectionHeader
              icon={FileSpreadsheet}
              title={isBn ? "গুগল শিট সংযোগ" : "Google Sheets Connection"}
              subtitle={
                isBn
                  ? "আপনার প্রোডাক্ট লিস্ট এবং অর্ডার কনফার্মেশনের জন্য আলাদা শিটের লিংক দিন।"
                  : "Connect your product list and order confirmation sheets."
              }
            />

            <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-primary/90">
                {isBn
                  ? "আপনি শুধু আপনার গুগল শিটে প্রোডাক্ট আপডেট করুন — AI স্বয়ংক্রিয়ভাবে রিয়েল-টাইম ডেটা পড়ে নেবে। বারবার সিঙ্ক করার কোনো ঝামেলা নেই!"
                  : "Just update your Google Sheet — the AI will automatically read live data every time. No manual syncing required!"}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {isBn ? "প্রোডাক্ট শিট" : "Product Sheet"}
                  </span>
                </div>
                <InputField
                  label={isBn ? "Google Sheets লিংক" : "Google Sheets URL"}
                  value={config.productSheetUrl}
                  onChange={(v) => patch("productSheetUrl", v)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  hint={
                    isBn
                      ? "শিটটি যে কেউ লিংক দিয়ে দেখতে পারবে এমন করে শেয়ার করুন (Viewer access)।"
                      : "Make sure the sheet is shared with 'Anyone with the link can view'."
                  }
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
                    <ExternalLink className="h-3 w-3" />
                    {isBn ? "শিট দেখুন" : "View Sheet"}
                  </a>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm font-semibold">
                    {isBn ? "অর্ডার কনফার্মেশন শিট" : "Order Confirmation Sheet"}
                  </span>
                </div>
                <InputField
                  label={isBn ? "Google Sheets লিংক" : "Google Sheets URL"}
                  value={config.orderSheetUrl}
                  onChange={(v) => patch("orderSheetUrl", v)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  hint={
                    isBn
                      ? "কাস্টমার অর্ডার কনফার্ম করলে AI স্বয়ংক্রিয়ভাবে এই শিটে নতুন সারি যোগ করবে।"
                      : "When a customer confirms an order, the AI will automatically add a new row to this sheet."
                  }
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
                    <ExternalLink className="h-3 w-3" />
                    {isBn ? "শিট দেখুন" : "View Sheet"}
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ──── Delivery Couriers ──── */}
          <div className="space-y-4">
            <SectionHeader
              icon={Truck}
              title={isBn ? "ডেলিভারি কুরিয়ার" : "Delivery Couriers"}
              subtitle={
                isBn
                  ? "আপনার ডেলিভারি পার্টনার চালু করুন। AI স্বয়ংক্রিয়ভাবে অর্ডার তৈরি করবে।"
                  : "Enable your delivery partner. The AI will automatically create orders upon confirmation."
              }
            />

            <CourierCard
              name="SteadFast Courier"
              tagline={
                isBn ? "বাংলাদেশের জনপ্রিয় ডেলিভারি সার্ভিস" : "Popular delivery service in Bangladesh"
              }
              logo="SF"
              enabled={config.steadfastEnabled}
              onToggle={() => patch("steadfastEnabled", !config.steadfastEnabled)}
              accentColor="#00a651"
              activeLabel={isBn ? "চালু" : "Active"}
            >
              <InputField
                label="API Key"
                value={config.steadfastApiKey}
                onChange={(v) => patch("steadfastApiKey", v)}
                placeholder="6mdxclldes8srhxk..."
                type="password"
                hint={
                  isBn
                    ? "SteadFast পোর্টাল থেকে API Key নিন।"
                    : "Get your API Key from the SteadFast portal."
                }
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
                <ExternalLink className="h-3 w-3" />
                {isBn ? "SteadFast পোর্টাল খুলুন" : "Open SteadFast Portal"}
              </a>
            </CourierCard>

            <CourierCard
              name="Pathao Courier"
              tagline={isBn ? "দ্রুত ও নির্ভরযোগ্য ডেলিভারি সার্ভিস" : "Fast and reliable delivery service"}
              logo="P"
              enabled={config.pathaoEnabled}
              onToggle={() => patch("pathaoEnabled", !config.pathaoEnabled)}
              accentColor="#e8192c"
              activeLabel={isBn ? "চালু" : "Active"}
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
                <ExternalLink className="h-3 w-3" />
                {isBn ? "Pathao API ডকুমেন্টেশন" : "Pathao API Documentation"}
              </a>
            </CourierCard>
          </div>
        </>
      )}
    </section>
  );
}
