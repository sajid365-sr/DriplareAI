"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import type { OrderRow } from "./_components/types";
import { OrdersHeader } from "./_components/OrdersHeader";
import { OrdersSearchBar } from "./_components/OrdersSearchBar";
import { OrdersTable } from "./_components/OrdersTable";
import { CreateOrderModal } from "./_components/CreateOrderModal";

/**
 * Inner content component that uses `useSearchParams()` and therefore
 * must be wrapped in a `<Suspense>` boundary.
 */
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

  useEffect(() => {
    fetchOrders();
  }, []);

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
      (Array.isArray(ord.items) &&
        ord.items.some((i) => i.name?.toLowerCase().includes(q)))
    );
  });

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
        <OrdersHeader
          loading={loading}
          syncing={syncing}
          onRefresh={fetchOrders}
          onSyncCourier={handleSyncCourier}
          onCreateOrder={() => setShowCreateModal(true)}
        />

        <OrdersSearchBar value={search} onChange={setSearch} />

        <OrdersTable orders={filteredOrders} loading={loading} />
      </motion.div>
    </>
  );
}

/**
 * Orders & Shipments page — displays all customer orders in a
 * searchable table with courier sync and manual order creation.
 */
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
