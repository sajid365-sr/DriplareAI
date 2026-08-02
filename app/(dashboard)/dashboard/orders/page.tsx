"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Search, Filter, Plus, Truck,
  ArrowUpRight, RefreshCw, X, Package, Phone,
  MapPin, Hash, User, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────
interface OrderRow {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  district?: string | null;
  items: { name: string; qty: number; price: number }[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  courierName?: string | null;
  courierTrackingId?: string | null;
  status: string;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Status badge color map ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Processing: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    Shipped:    "bg-blue-500/15 text-blue-500 border-blue-500/30",
    Delivered:  "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    Returned:   "bg-red-500/15 text-red-500 border-red-500/30",
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${colors[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

// ── Payment badge ──────────────────────────────────────────────────────────
function PaymentBadge({ method, paymentStatus }: { method: string; paymentStatus: string }) {
  const isPaid = paymentStatus === "paid";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-foreground">{method}</span>
      <span className={`text-[10px] font-bold ${isPaid ? "text-emerald-500" : "text-amber-500"}`}>
        {isPaid ? "✓ Paid" : "Pending"}
      </span>
    </div>
  );
}

// ── Create Manual Order Modal ──────────────────────────────────────────────
function CreateOrderModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    customerName: "", customerPhone: "", deliveryAddress: "",
    district: "", product: "", qty: "1", price: "1850", courierName: "Steadfast",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.product) {
      toast.error("Customer name and product are required");
      return;
    }
    setSubmitting(true);
    try {
      const items = [{ name: form.product, qty: parseInt(form.qty), price: parseFloat(form.price) }];
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        toast.success(`✓ Order ${data.order.orderId} created! Tracking: ${data.order.courierTrackingId}`);
        onCreated();
        onClose();
      } else {
        toast.error("Failed to create order");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 10 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Create Manual Order
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "customerName", label: "Customer Name", icon: User, type: "text", col: 2 },
              { key: "customerPhone", label: "Phone Number", icon: Phone, type: "tel", col: 1 },
              { key: "district", label: "District", icon: MapPin, type: "text", col: 1 },
              { key: "deliveryAddress", label: "Delivery Address", icon: MapPin, type: "text", col: 2 },
              { key: "product", label: "Product Name", icon: Package, type: "text", col: 2 },
              { key: "qty", label: "Quantity", icon: Hash, type: "number", col: 1 },
              { key: "price", label: "Unit Price (৳)", icon: Hash, type: "number", col: 1 },
            ].map(({ key, label, icon: Icon, type, col }) => (
              <div key={key} className={col === 2 ? "col-span-2" : "col-span-1"}>
                <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                  <input
                    type={type}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full pl-7 pr-2.5 py-2 bg-muted/50 border border-border/50 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>
            ))}
            <div className="col-span-2">
              <label className="text-[11px] text-muted-foreground font-semibold mb-1 block">Courier</label>
              <select
                value={form.courierName}
                onChange={(e) => setForm((f) => ({ ...f, courierName: e.target.value }))}
                className="w-full px-2.5 py-2 bg-muted/50 border border-border/50 rounded-lg text-[12px] outline-none"
              >
                <option>Steadfast</option>
                <option>Pathao</option>
                <option>RedX</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-500 text-white text-[13px] font-bold disabled:opacity-50"
          >
            {submitting ? "Creating Order..." : "Create & Dispatch Order"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Orders Content ────────────────────────────────────────────────────────
function OrdersContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") || "";

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState(urlSearch);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (Array.isArray(data.orders)) setOrders(data.orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleSyncCourier = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/orders/sync-courier", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Courier status synced!");
        await fetchOrders();
      } else {
        toast.error("Sync failed");
      }
    } catch {
      toast.error("Error syncing courier status");
    } finally {
      setSyncing(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ord.orderId?.toLowerCase().includes(q) ||
      ord.customerName?.toLowerCase().includes(q) ||
      ord.customerPhone?.toLowerCase().includes(q) ||
      ord.courierTrackingId?.toLowerCase().includes(q) ||
      (Array.isArray(ord.items) && ord.items.some((i) => i.name?.toLowerCase().includes(q)))
    );
  });

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return (
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold text-foreground">
          {d.toLocaleDateString("en-GB")}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: true })}
        </span>
      </div>
    );
  };

  const getItemsSummary = (items: OrderRow["items"]) => {
    if (!Array.isArray(items) || items.length === 0) return "—";
    const first = items[0];
    const extra = items.length > 1 ? ` +${items.length - 1} more` : "";
    return `${first.name} ×${first.qty}${extra}`;
  };

  return (
    <>
      <AnimatePresence>
        {showCreateModal && (
          <CreateOrderModal
            onClose={() => setShowCreateModal(false)}
            onCreated={fetchOrders}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-primary" />
              Orders &amp; Shipments
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage customer orders, track courier dispatches, and trigger tracking updates.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleSyncCourier}
              disabled={syncing}
            >
              <Truck className={`w-4 h-4 ${syncing ? "animate-bounce" : ""}`} />
              {syncing ? "Syncing..." : "Sync Courier Status"}
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              Create Manual Order
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border/60">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer, Phone, Tracking..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </Button>
        </div>

        {/* Orders Table */}
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border/40 text-[11px] uppercase font-semibold tracking-wide">
                <tr>
                  <th className="p-4 whitespace-nowrap">Order ID</th>
                  <th className="p-4 whitespace-nowrap">Customer</th>
                  <th className="p-4 whitespace-nowrap">Item Details</th>
                  <th className="p-4 whitespace-nowrap">Amount</th>
                  <th className="p-4 whitespace-nowrap">Courier &amp; Tracking</th>
                  <th className="p-4 whitespace-nowrap">Payment (COD)</th>
                  <th className="p-4 whitespace-nowrap">Status</th>
                  <th className="p-4 whitespace-nowrap">Date &amp; Time</th>
                  <th className="p-4 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground text-sm">
                      <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                      Loading orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground text-sm">
                      No orders found. Create a new order from Live Inbox or manually.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                      {/* ORDER ID */}
                      <td className="p-4 font-mono font-bold text-primary text-sm">
                        {ord.orderId}
                      </td>

                      {/* CUSTOMER */}
                      <td className="p-4">
                        <p className="font-semibold text-foreground text-[12.5px]">{ord.customerName}</p>
                        {ord.customerPhone && (
                          <p className="text-[11px] text-muted-foreground">{ord.customerPhone}</p>
                        )}
                        {ord.district && (
                          <p className="text-[10.5px] text-muted-foreground/70">{ord.district}</p>
                        )}
                      </td>

                      {/* ITEM DETAILS */}
                      <td className="p-4 text-[12px] text-muted-foreground max-w-[160px]">
                        <p className="truncate">{getItemsSummary(ord.items)}</p>
                      </td>

                      {/* AMOUNT */}
                      <td className="p-4">
                        <p className="font-bold text-foreground text-[13px]">
                          ৳{Number(ord.totalAmount).toLocaleString()}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">{ord.paymentMethod}</p>
                      </td>

                      {/* COURIER & TRACKING */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary border border-border w-fit">
                            <Truck className="w-3 h-3 text-muted-foreground" />
                            {ord.courierName ?? "—"}
                          </span>
                          {ord.courierTrackingId && (
                            <span className="font-mono text-[10.5px] text-primary font-semibold">
                              {ord.courierTrackingId}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PAYMENT STATUS (COD) */}
                      <td className="p-4">
                        <PaymentBadge method={ord.paymentMethod} paymentStatus={ord.paymentStatus} />
                      </td>

                      {/* STATUS */}
                      <td className="p-4">
                        <StatusBadge status={ord.status} />
                      </td>

                      {/* DATE & TIME */}
                      <td className="p-4">
                        {formatDateTime(ord.createdAt)}
                      </td>

                      {/* ACTION */}
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs">
                          Details
                          <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-primary" />
          Loading Orders...
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
