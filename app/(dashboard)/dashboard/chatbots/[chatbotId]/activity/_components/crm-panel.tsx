"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ChevronDown, ChevronUp, User, Tag, FileText, Sparkles,
  Phone, Package, MapPin, Hash, Plus, Globe,
  CheckCircle2, Clock, Truck, ShoppingCart, AlertCircle,
  Edit3, Zap, RefreshCw, ExternalLink, X, Loader2, Send,
  History, Star, ArrowRight,
} from "lucide-react";
import { LeadStatusBadge, LeadStatus } from "./lead-status-badge";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────
interface CartItem {
  name: string;
  qty: number;
  price: number;
}

interface AiExtractionState {
  phone: string | null;
  address: string | null;
  district: string | null;
  cartItems: CartItem[];
  orderStatus: "browsing" | "details_captured" | "confirmed";
  orderId: string | null;
  courierTrackingId: string | null;
}

// Shape of an active Order as returned by the API
interface ActiveOrderShape {
  orderId: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  district: string | null;
  items: { name: string; qty: number; price: number }[];
  courierName: string | null;
  courierTrackingId: string | null;
  status: string;
}

interface CrmPanelProps {
  session: {
    sessionId: string;
    title: string;
    platform: string;
    profilePhoto?: string | null;
    leadStatus?: string;
  } | null;
  messages: any[];
  chatbotId?: string | null;
  onUpdateLeadStatus: (sessionId: string, status: LeadStatus) => void;
}

// ── Section accordion wrapper ──────────────────────────────────────────────
function Section({
  icon: Icon, title, badgeText, rightAction, defaultOpen = true, children,
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
      <div
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/40 transition-colors select-none cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[12.5px] font-semibold text-foreground">{title}</span>
          {badgeText !== undefined && (
            <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full text-[10px] font-semibold">
              {badgeText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {rightAction}
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>
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

// ── Order lifecycle status badge ───────────────────────────────────────────
function OrderStatusBadge({ status, orderId, tracking }: {
  status: AiExtractionState["orderStatus"];
  orderId: string | null;
  tracking: string | null;
}) {
  const configs = {
    browsing: {
      icon: Clock,
      label: "Browsing",
      color: "bg-muted/60 text-muted-foreground border-border/50",
      dot: "bg-muted-foreground",
    },
    details_captured: {
      icon: Zap,
      label: "Details Captured by AI",
      color: "bg-amber-500/10 text-amber-500 border-amber-500/30",
      dot: "bg-amber-500 animate-pulse",
    },
    confirmed: {
      icon: CheckCircle2,
      label: orderId ? `Confirmed & Dispatched (${orderId})` : "Confirmed & Dispatched",
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
  };
  const cfg = configs[status];
  const Icon = cfg.icon;
  return (
    <div className={`flex flex-col gap-1 px-3 py-2.5 rounded-xl border ${cfg.color}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="text-[11.5px] font-bold">{cfg.label}</span>
      </div>
      {tracking && (
        <p className="text-[10.5px] font-mono pl-4 opacity-80">
          Tracking: {tracking}
        </p>
      )}
    </div>
  );
}

// ── Extraction field badge ─────────────────────────────────────────────────
function ExtractionBadge({ icon: Icon, label, value, extracted }: {
  icon: React.ElementType;
  label: string;
  value: string | null;
  extracted: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11.5px] text-muted-foreground">{label}:</span>
      </div>
      <div className="flex items-center gap-1.5 min-w-0">
        {extracted && value ? (
          <>
            <span className="text-[11.5px] font-semibold text-foreground truncate max-w-[120px]">
              {value}
            </span>
            <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[9.5px] font-bold border border-emerald-500/25">
              <CheckCircle2 className="w-2.5 h-2.5" />
              AI
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[9.5px] font-semibold border border-border/40">
            <Clock className="w-2.5 h-2.5" />
            Pending AI Request
          </span>
        )}
      </div>
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

// ── Override Order Modal ───────────────────────────────────────────────────
function OverrideOrderModal({
  session,
  extraction,
  chatbotId,
  onClose,
  onCreated,
}: {
  session: { title: string; sessionId: string };
  extraction: AiExtractionState;
  chatbotId: string;
  onClose: () => void;
  onCreated: (order: {
    orderId: string;
    phone: string | null;
    address: string | null;
    district: string | null;
    items: { name: string; qty: number; price: number }[];
    courierTrackingId: string | null;
  }) => void;
}) {
  const firstItem = extraction.cartItems[0];
  const [form, setForm] = useState({
    customerName: session.title ?? "",
    customerPhone: extraction.phone ?? "",
    deliveryAddress: extraction.address ?? "",
    district: extraction.district ?? "",
    product: firstItem?.name ?? "",
    qty: String(firstItem?.qty ?? 1),
    price: String(firstItem?.price ?? 0),
    courierName: "Steadfast",
  });
  const [submitting, setSubmitting] = useState(false);

  const parsedQty = parseInt(form.qty) || 0;
  const parsedPrice = parseFloat(form.price) || 0;
  const totalAmount = parsedQty * parsedPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) {
      toast.error("Please enter customer name");
      return;
    }
    setSubmitting(true);
    try {
      const items = [{ name: form.product || "General Item", qty: parsedQty || 1, price: parsedPrice || 0 }];
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          sessionId: session.sessionId,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          deliveryAddress: form.deliveryAddress,
          district: form.district,
          items,
          courierName: form.courierName,
        }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        toast.success(`✓ Order ${data.order.orderId} created & dispatched!`);
        // Pass full order data so the panel can update immediately without a page refresh
        onCreated({
          orderId: data.order.orderId,
          phone: form.customerPhone || null,
          address: form.deliveryAddress || null,
          district: form.district || null,
          items,
          courierTrackingId: data.order.courierTrackingId ?? null,
        });
      } else {
        toast.error(data.error || "Failed to create order");
      }
    } catch {
      toast.error("Error creating order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-card text-card-foreground border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/40 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8.5 h-8.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Edit3 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground leading-tight">
                Override / Edit Order
              </h3>
              <p className="text-[11.5px] text-muted-foreground">
                Manual review & dispatch for {session.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Row 1: Customer Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
                Customer Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                required
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Enter customer name"
                className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                placeholder="e.g. 01700000000"
                className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Row 2: Delivery Address */}
          <div>
            <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
              Delivery Address
            </label>
            <input
              type="text"
              value={form.deliveryAddress}
              onChange={(e) => setForm((f) => ({ ...f, deliveryAddress: e.target.value }))}
              placeholder="House, Road, Area details"
              className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>

          {/* Row 3: District & Courier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
                District / Region
              </label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                placeholder="e.g. Dhaka, Chittagong"
                className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
                Courier Partner
              </label>
              <select
                value={form.courierName}
                onChange={(e) => setForm((f) => ({ ...f, courierName: e.target.value }))}
                className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none cursor-pointer"
              >
                <option value="Steadfast">Steadfast Courier</option>
                <option value="Pathao">Pathao Courier</option>
                <option value="RedX">RedX Logistics</option>
              </select>
            </div>
          </div>

          {/* Row 4: Product Name */}
          <div>
            <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
              Product Name
            </label>
            <input
              type="text"
              value={form.product}
              onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))}
              placeholder="e.g. Driplare Premium Package"
              className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>

          {/* Row 5: Quantity, Unit Price & Calculated Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={form.qty}
                onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-foreground/90 block mb-1">
                Unit Price (৳)
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full px-3.5 py-2 bg-background border border-border/80 rounded-xl text-[13px] font-medium text-foreground shadow-2xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Total Amount Summary Box */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-xl">
            <span className="text-[12.5px] font-semibold text-foreground">
              Total Order Amount (COD):
            </span>
            <span className="text-[14px] font-bold text-primary">
              ৳ {totalAmount.toLocaleString()}
            </span>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-[13px] font-bold shadow-md shadow-violet-500/20 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Order...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Confirm & Dispatch Order</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main CrmPanel Component ────────────────────────────────────────────────
export function CrmPanel({ session, messages, chatbotId, onUpdateLeadStatus }: CrmPanelProps) {
  const { t } = useTranslation("live-inbox");
  const [notes, setNotes] = useState("");
  const [customTags, setCustomTags] = useState<string[]>(["Top Client"]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [extraction, setExtraction] = useState<AiExtractionState>({
    phone: null, address: null, district: null,
    cartItems: [], orderStatus: "browsing",
    orderId: null, courierTrackingId: null,
  });
  // Order history for repeat customer detection
  const [orderHistory, setOrderHistory] = useState<ActiveOrderShape[]>([]);
  const sseRef = useRef<EventSource | null>(null);

  // ── Fetch latest active order from DB when session changes ────────────────
  useEffect(() => {
    if (!session?.sessionId) return;

    // Reset first so panel is clean during fetch
    setExtraction({
      phone: null, address: null, district: null,
      cartItems: [], orderStatus: "browsing",
      orderId: null, courierTrackingId: null,
    });
    setOrderHistory([]);

    // Fetch the latest order associated with this session from the DB
    fetch(`/api/orders?sessionId=${session.sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        const order: ActiveOrderShape | null = data?.order ?? null;
        if (order && order.orderId) {
          // Seed extraction state with confirmed order data from DB
          setExtraction({
            phone: order.customerPhone,
            address: order.deliveryAddress,
            district: order.district,
            cartItems: Array.isArray(order.items) ? order.items : [],
            orderStatus: "confirmed",
            orderId: order.orderId,
            courierTrackingId: order.courierTrackingId,
          });
        }
      })
      .catch(() => { /* silently fail */ });

    // Fetch all orders for this session to detect repeat customers
    fetch(`/api/orders?sessionId=${session.sessionId}&all=true`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.orders)) {
          setOrderHistory(data.orders as ActiveOrderShape[]);
        }
      })
      .catch(() => { /* silently fail */ });
  }, [session?.sessionId]);

  // ── SSE subscription for real-time AI extraction updates ─────────────────
  useEffect(() => {
    if (!session || !chatbotId) return;

    // Close previous SSE connection
    sseRef.current?.close();

    const url = `/api/chatbots/${chatbotId}/sessions/${session.sessionId}/sse`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && typeof data === "object") {
          setExtraction((prev) => ({
            phone: data.phone ?? prev.phone,
            address: data.address ?? prev.address,
            district: data.district ?? prev.district,
            cartItems: Array.isArray(data.cartItems) && data.cartItems.length > 0
              ? data.cartItems : prev.cartItems,
            orderStatus: data.orderStatus ?? prev.orderStatus,
            orderId: data.orderId ?? prev.orderId,
            courierTrackingId: data.courierTrackingId ?? prev.courierTrackingId,
          }));
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => es.close();

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [session?.sessionId, chatbotId]);

  if (!session) {
    return (
      <div className="w-full flex flex-col items-center justify-center h-full bg-card border border-border/60 rounded-xl shadow-xs text-muted-foreground">
        <User className="w-8 h-8 opacity-20 mb-2" />
        <p className="text-[12px]">{t("conversation.selectPrompt")}</p>
      </div>
    );
  }

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newTagInput.trim()) {
      setCustomTags((prev) => Array.from(new Set([...prev, newTagInput.trim()])));
      toast.success(`Tag "${newTagInput.trim()}" added`);
      setNewTagInput("");
      setIsAddingTag(false);
    }
  };

  const cartTotal = extraction.cartItems.reduce(
    (sum, item) => sum + item.price * item.qty, 0
  );

  const lastMessages = messages.slice(-4);
  const aiSummary =
    lastMessages.length > 0
      ? lastMessages
          .filter((m) => m.role === "assistant")
          .map((m) => m.content.slice(0, 60))
          .join(" … ")
          .slice(0, 160) || null
      : null;

  // Platform badge color
  const platformColors: Record<string, string> = {
    facebook: "bg-blue-600/10 text-blue-500 border-blue-500/30",
    instagram: "bg-pink-600/10 text-pink-500 border-pink-500/30",
    whatsapp: "bg-emerald-600/10 text-emerald-500 border-emerald-500/30",
    web: "bg-violet-600/10 text-violet-500 border-violet-500/30",
  };
  const platformColor = platformColors[session.platform] ?? "bg-muted text-muted-foreground border-border";

  return (
    <>
      {/* ── Override Order Modal ── */}
      <AnimatePresence>
        {showOverrideModal && chatbotId && (
          <OverrideOrderModal
            session={session}
            extraction={extraction}
            chatbotId={chatbotId}
            onClose={() => setShowOverrideModal(false)}
            onCreated={({ orderId, phone, address, district, items, courierTrackingId }) => {
              // Instantly update the Right Panel with all confirmed order data
              setExtraction({
                phone: phone ?? null,
                address: address ?? null,
                district: district ?? null,
                cartItems: items ?? [],
                orderStatus: "confirmed",
                orderId,
                courierTrackingId: courierTrackingId ?? null,
              });
              setShowOverrideModal(false);
            }}
          />
        )}
      </AnimatePresence>

      <div className="w-full flex flex-col h-full bg-card border border-border/60 rounded-xl shadow-xs overflow-hidden relative">

        {/* ── Top: Customer Identity Header ── */}
        <div className="p-3 border-b border-border/50 bg-card shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-violet-500" />
              Live AI Order Detector
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${platformColor}`}>
              {session.platform}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {session.profilePhoto ? (
              <img src={session.profilePhoto} className="w-8 h-8 rounded-full object-cover border border-border/40" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[13px] font-bold text-foreground leading-tight">{session.title}</p>
                {/* Repeat Customer / VIP badge */}
                {orderHistory.length > 1 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/25 text-[9.5px] font-bold">
                    <Star className="w-2.5 h-2.5" />
                    Repeat Customer
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground">Session #{session.sessionId.slice(-6)}</p>
            </div>
          </div>
        </div>

        {/* ── Scrollable Sections ── */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-thin scrollbar-thumb-border/40 pb-4">

          {/* 1. Live AI Extraction Card */}
          <Section icon={Zap} title="AI Extraction Status" defaultOpen>
            <div className="space-y-3">
              {/* Order lifecycle badge */}
              <OrderStatusBadge
                status={extraction.orderStatus}
                orderId={extraction.orderId}
                tracking={extraction.courierTrackingId}
              />

              {/* Phone & Address extraction */}
              <div className="space-y-1 border border-border/40 rounded-xl p-2.5 bg-muted/20">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Extracted Contact Data
                </p>
                <ExtractionBadge
                  icon={Phone}
                  label="Phone"
                  value={extraction.phone}
                  extracted={!!extraction.phone}
                />
                <ExtractionBadge
                  icon={MapPin}
                  label="Address"
                  value={extraction.address ?? extraction.district}
                  extracted={!!(extraction.address || extraction.district)}
                />
              </div>

              {/* Override button */}
              <button
                onClick={() => setShowOverrideModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-[11.5px] font-semibold transition-all"
              >
                <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                Override / Edit Order
              </button>
            </div>
          </Section>

          {/* 2. Detected Cart Items */}
          <Section
            icon={ShoppingCart}
            title="Detected Cart Items"
            badgeText={extraction.cartItems.length || undefined}
            defaultOpen
          >
            {extraction.cartItems.length > 0 ? (
              <div className="space-y-2">
                {extraction.cartItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-foreground truncate">{item.name}</span>
                      <span className="text-muted-foreground shrink-0">×{item.qty}</span>
                    </div>
                    <span className="font-semibold text-foreground shrink-0 ml-2">
                      ৳{(item.price * item.qty).toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-semibold">Total (COD)</span>
                  <span className="text-[13px] font-bold text-primary">৳{cartTotal.toLocaleString()}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11.5px] text-muted-foreground italic flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                No products detected yet. AI is listening...
              </p>
            )}
          </Section>

          {/* 3. Conversation Summary */}
          <Section icon={Sparkles} title={t("crm.aiSummary")} defaultOpen>
            {aiSummary ? (
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">{aiSummary}…</p>
            ) : (
              <p className="text-[11.5px] text-muted-foreground italic">{t("crm.noSummary")}</p>
            )}
          </Section>

          {/* 4. Internal Staff Notes (renamed from "Notes for customer") */}
          <Section icon={FileText} title="Internal Staff Notes" defaultOpen={false}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes for staff only (e.g. Customer requested delivery after 5 PM)..."
              rows={3}
              className="w-full px-2.5 py-1.5 bg-muted/50 border border-border/50 rounded-lg text-[11.5px] placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
            />
          </Section>

          {/* 5. Contact Details + Tags */}
          <Section icon={User} title={t("crm.title")} defaultOpen={false}>
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("crm.name")}:</span>
                <span className="font-medium text-foreground">{session.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("crm.platform")}:</span>
                <span className="font-medium text-foreground capitalize">{session.platform}</span>
              </div>
              {extraction.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("crm.phone")}:</span>
                  <span className="font-medium text-foreground">{extraction.phone}</span>
                </div>
              )}
            </div>
          </Section>

          {/* 6. Tags & Lead Status */}
          <Section
            icon={Tag}
            title={t("crm.tags")}
            rightAction={
              <button
                type="button"
                onClick={() => setIsAddingTag((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {t("crm.addTag")}
              </button>
            }
            defaultOpen={false}
          >
            <div className="space-y-2">
              {isAddingTag && (
                <form onSubmit={handleAddCustomTag} className="flex items-center gap-1.5 pb-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="New tag name..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    className="flex-1 px-2 py-1 bg-muted border border-border rounded text-[11px] outline-none"
                  />
                  <button type="submit" className="px-2 py-1 bg-primary text-primary-foreground text-[10.5px] font-bold rounded">
                    Add
                  </button>
                </form>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <LeadStatusBadge status={session.leadStatus ?? "priority"} />
                {customTags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10.5px] font-semibold">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-1">
                {LEAD_STATUSES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      onUpdateLeadStatus(session.sessionId, value);
                      toast.success(`Lead status updated to ${label}`);
                    }}
                    className={`px-2 py-1 rounded text-[10.5px] font-medium text-left transition-colors ${
                      session.leadStatus === value
                        ? "bg-primary/20 text-primary font-bold border border-primary/30"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* 7. Recent Order History (Repeat Customer Section) */}
          {orderHistory.length > 0 && (
            <Section
              icon={History}
              title="Order History"
              badgeText={orderHistory.length}
              defaultOpen
            >
              <div className="space-y-2">
                {/* Show last 2 orders */}
                {orderHistory.slice(0, 2).map((ord) => {
                  const firstItem = Array.isArray(ord.items) && ord.items.length > 0 ? ord.items[0] : null;
                  const ordDate = (ord as any).createdAt
                    ? new Date((ord as any).createdAt).toLocaleDateString("en-GB")
                    : null;
                  return (
                    <div
                      key={ord.orderId}
                      className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/40"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[11.5px] font-bold text-foreground flex items-center gap-1.5">
                          <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                          {ord.orderId}
                        </p>
                        {firstItem && (
                          <p className="text-[10.5px] text-muted-foreground truncate">
                            {firstItem.name} ×{firstItem.qty}
                          </p>
                        )}
                        {ordDate && (
                          <p className="text-[10px] text-muted-foreground/70">{ordDate}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11.5px] font-bold text-primary">
                          ৳{((ord as any).totalAmount ?? 0).toLocaleString()}
                        </p>
                        {ord.courierTrackingId && (
                          <p className="text-[9.5px] font-mono text-muted-foreground mt-0.5">
                            {ord.courierTrackingId}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* See All Orders link */}
                <Link
                  href={`/dashboard/orders${extraction.phone ? `?search=${encodeURIComponent(extraction.phone)}` : ""}`}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11.5px] font-semibold transition-all"
                >
                  <History className="w-3.5 h-3.5" />
                  See All Orders ({orderHistory.length})
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </Section>
          )}

        </div>
      </div>
    </>
  );
}
