"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ElementType, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Send,
  ShoppingBag,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
  WebsiteWidgetIcon,
} from "@/components/icons/PlatformIcons";
import { LeadStatusBadge } from "@/app/(dashboard)/dashboard/chatbots/[chatbotId]/activity/_components/lead-status-badge";

export type StaffNote = {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
};

export type CustomerOrder = {
  orderId: string;
  items: unknown;
  totalAmount: number;
  status: string;
  createdAt: string;
};

export type CustomerLead = {
  id: string;
  guestName: string;
  profilePhoto: string | null;
  platform: string;
  phone: string | null;
  address?: string | null;
  aiTags: string[];
  aiSummary?: string[];
  buyingIntentScore?: number;
  staffNotes?: StaffNote[];
  orderHistory?: CustomerOrder[];
  totalOrders: number;
  totalSpent: number;
  firstContact?: string;
  lastActive: string;
  updatedAt: string;
};

type CustomerCrmDrawerProps = {
  customer: CustomerLead | null;
  onClose: () => void;
  onNoteAdded?: (sessionId: string, notes: StaffNote[]) => void;
};

function formatCurrency(value: number) {
  return `৳${Math.round(value || 0).toLocaleString("en-BD")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function getPlatformIcon(platform: string): ElementType {
  const normalized = platform.toLowerCase();
  if (normalized.includes("facebook")) return FacebookIcon;
  if (normalized.includes("whatsapp")) return WhatsAppIcon;
  if (normalized.includes("instagram")) return InstagramIcon;
  return WebsiteWidgetIcon;
}

function PlatformBadge({ platform }: { platform: string }) {
  const Icon = getPlatformIcon(platform);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-semibold capitalize text-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {platform}
    </span>
  );
}

function CustomerAvatar({ customer }: { customer: CustomerLead }) {
  if (customer.profilePhoto) {
    return (
      <img
        src={customer.profilePhoto}
        alt={customer.guestName}
        className="h-11 w-11 rounded-full border border-border/50 object-cover"
      />
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-base font-bold text-primary">
      {(customer.guestName || "C").charAt(0).toUpperCase()}
    </div>
  );
}

function Section({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: ElementType;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function intentLabel(score: number) {
  if (score >= 80) return "High Intent";
  if (score >= 60) return "Warm Intent";
  if (score >= 40) return "Moderate Intent";
  return "Low Intent";
}

type NormalizedOrderItem = {
  name: string;
  qty?: number;
  price?: number;
};

function normalizeOrderItems(items: unknown): NormalizedOrderItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map<NormalizedOrderItem | null>((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      return {
        name: typeof record.name === "string" ? record.name : "Item",
        qty: typeof record.qty === "number" ? record.qty : undefined,
        price: typeof record.price === "number" ? record.price : undefined,
      };
    })
    .filter((item): item is NormalizedOrderItem => Boolean(item));
}

function orderStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (["delivered", "completed", "dispatched", "shipped"].includes(normalized)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
  }
  if (["cancelled", "canceled", "failed", "returned", "refunded"].includes(normalized)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-500";
  }
  return "border-amber-500/30 bg-amber-500/10 text-amber-500";
}

export function CustomerCrmDrawer({ customer, onClose, onNoteAdded }: CustomerCrmDrawerProps) {
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const notes = customer?.staffNotes || [];
  const score = customer?.buyingIntentScore ?? 55;
  const summaries = useMemo(() => {
    if (!customer) return [];
    return customer.aiSummary && customer.aiSummary.length > 0
      ? customer.aiSummary
      : ["No AI summary is available for this customer yet."];
  }, [customer]);

  useEffect(() => {
    if (!customer) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [customer, onClose]);

  const handleAddNote = async () => {
    if (!customer || !noteText.trim()) return;

    setSavingNote(true);
    try {
      const res = await fetch("/api/crm/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: customer.id,
          noteText: noteText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");

      onNoteAdded?.(customer.id, data.notes || []);
      setNoteText("");
      toast.success("Internal note added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <AnimatePresence>
      {customer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/75 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <CustomerAvatar customer={customer} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-foreground">{customer.guestName}</h2>
                  <div className="mt-1">
                    <PlatformBadge platform={customer.platform} />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/dashboard/inbox?session=${encodeURIComponent(customer.id)}`}
                  className={buttonVariants({ size: "sm", className: "gap-2" })}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Live Chat
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close CRM drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <Section title="Basic Contact Info" Icon={User}>
                <div className="grid gap-3 text-sm">
                  <InfoRow Icon={Phone} label="Phone Number" value={customer.phone || "Not captured"} />
                  <InfoRow Icon={MessageSquare} label="Channel" value={customer.platform} />
                  <InfoRow Icon={MapPin} label="Primary Delivery Address" value={customer.address || "Not captured"} />
                  <InfoRow Icon={CalendarDays} label="First Contact" value={formatDate(customer.firstContact)} />
                  <InfoRow Icon={CalendarDays} label="Last Active" value={formatDate(customer.lastActive)} />
                </div>
              </Section>

              <Section title="AI Intelligence & Insights" Icon={Sparkles}>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Buying Intent Score</span>
                      <span className="text-foreground">
                        {score}% - {intentLabel(score)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${score}%` }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {summaries.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {customer.aiTags.length > 0 ? (
                      customer.aiTags.map((tag) => <LeadStatusBadge key={tag} status={tag} />)
                    ) : (
                      <span className="text-xs text-muted-foreground">No AI tags detected yet.</span>
                    )}
                  </div>
                </div>
              </Section>

              <Section title="Order History" Icon={ShoppingBag}>
                {customer.orderHistory && customer.orderHistory.length > 0 ? (
                  <div className="space-y-2">
                    {customer.orderHistory.map((order) => {
                      const items = normalizeOrderItems(order.items);
                      return (
                        <div key={order.orderId} className="rounded-xl border border-border/50 bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-mono text-xs font-bold text-primary">{order.orderId}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${orderStatusClass(order.status)}`}>
                              {order.status}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1">
                            {items.length > 0 ? (
                              items.map((item, index) => (
                                <div key={`${order.orderId}-${index}`} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                                    <Package className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{item.name}</span>
                                  </span>
                                  <span className="shrink-0 font-semibold text-foreground">
                                    {item.qty ? `x${item.qty}` : ""} {typeof item.price === "number" ? formatCurrency(item.price) : ""}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground">No item details saved.</p>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-bold text-foreground">{formatCurrency(order.totalAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No past orders found for this customer.</p>
                )}
              </Section>

              <Section title="Internal Staff Notes" Icon={FileText}>
                <div className="space-y-3">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <div key={note.id} className="rounded-xl border border-border/50 bg-card p-3">
                        <p className="text-sm text-foreground">{note.text}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {note.authorName} - {formatDate(note.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No internal notes yet.</p>
                  )}

                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      rows={3}
                      placeholder="Add an internal note for your team..."
                      className="w-full resize-none rounded-xl border border-border/70 bg-background p-3 text-sm text-foreground outline-none transition focus:ring-2 focus:ring-primary/35"
                    />
                    <Button
                      type="button"
                      onClick={handleAddNote}
                      disabled={savingNote || !noteText.trim()}
                      className="w-full gap-2"
                    >
                      <Send className="h-3.5 w-3.5" />
                      {savingNote ? "Adding..." : "Add Note"}
                    </Button>
                  </div>
                </div>
              </Section>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoRow({ Icon, label, value }: { Icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span className="max-w-[55%] text-right font-medium capitalize text-foreground">{value}</span>
    </div>
  );
}
