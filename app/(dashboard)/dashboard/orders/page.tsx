"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import type { OrderRow } from "./_components/types";
import { OrdersHeader } from "./_components/OrdersHeader";
import { OrdersSearchBar } from "./_components/OrdersSearchBar";
import { OrdersTable } from "./_components/OrdersTable";
import { OrderSheet } from "./_components/OrderSheet";
import { FloatingBulkActionBar } from "./_components/FloatingBulkActionBar";
import { TrackingModal } from "./_components/TrackingModal";
import { DeleteConfirmModal } from "./_components/DeleteConfirmModal";
import { BulkDeleteConfirmModal } from "./_components/BulkDeleteConfirmModal";

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

  // Selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [dispatchingBulk, setDispatchingBulk] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Sheet (Drawer) state for Create & Edit
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<"create" | "edit">("create");
  const [activeOrder, setActiveOrder] = useState<OrderRow | null>(null);

  // Tracking modal state
  const [trackingOrder, setTrackingOrder] = useState<OrderRow | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);

  // Single delete confirm modal state
  const [deletingOrder, setDeletingOrder] = useState<OrderRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Sync courier status handler
  const handleSyncCourier = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/orders/sync-status", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Courier status synced successfully!");
        await fetchOrders();
      } else {
        toast.error(data.error || "Courier status sync failed");
      }
    } catch {
      toast.error("Error syncing courier status");
    } finally {
      setSyncing(false);
    }
  };

  // Selection Handlers
  const handleSelectOrder = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds((prev) => [...prev, id]);
    } else {
      setSelectedOrderIds((prev) => prev.filter((item) => item !== id));
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  // Bulk Dispatch Handler
  const handleBulkDispatch = async (courierProvider: string) => {
    if (selectedOrderIds.length === 0) return;
    setDispatchingBulk(true);
    try {
      const res = await fetch("/api/orders/bulk-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          courierProvider,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          data.message || `Dispatched ${selectedOrderIds.length} orders to ${courierProvider}!`
        );
        setSelectedOrderIds([]);
        await fetchOrders();
      } else {
        toast.error(data.error || "Bulk dispatch failed");
      }
    } catch {
      toast.error("Error connecting to bulk dispatch API");
    } finally {
      setDispatchingBulk(false);
    }
  };

  // Bulk Delete Handler
  const handleConfirmBulkDelete = async () => {
    if (selectedOrderIds.length === 0) return;
    setDeletingBulk(true);
    try {
      const res = await fetch("/api/orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Deleted ${selectedOrderIds.length} order(s).`);
        setSelectedOrderIds([]);
        await fetchOrders();
      } else {
        toast.error(data.error || "Failed to delete orders");
      }
    } catch {
      toast.error("Error connecting to bulk delete API");
    } finally {
      setDeletingBulk(false);
    }
  };

  // Action Menu Trigger Handlers
  const handleOpenCreate = () => {
    setActiveOrder(null);
    setSheetMode("create");
    setSheetOpen(true);
  };

  const handleOpenEdit = (order: OrderRow) => {
    setActiveOrder(order);
    setSheetMode("edit");
    setSheetOpen(true);
  };

  const handleOpenTrack = (order: OrderRow) => {
    setTrackingOrder(order);
    setTrackingOpen(true);
  };

  const handleOpenDelete = (order: OrderRow) => {
    setDeletingOrder(order);
    setDeleteOpen(true);
  };

  return (
    <>
      {/* Right Drawer (Sheet) for Order Creation & Editing */}
      <OrderSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        order={activeOrder}
        onSuccess={fetchOrders}
      />

      {/* Quick Courier Tracking Modal */}
      <TrackingModal
        order={trackingOrder}
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
      />

      {/* Single Order Delete Confirmation Modal */}
      <DeleteConfirmModal
        order={deletingOrder}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          setSelectedOrderIds((prev) => prev.filter((id) => id !== deletingOrder?.id));
          fetchOrders();
        }}
      />

      {/* Bulk Orders Delete Confirmation Modal */}
      <BulkDeleteConfirmModal
        selectedCount={selectedOrderIds.length}
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirmDelete={handleConfirmBulkDelete}
      />

      {/* Floating Bulk Action Bar */}
      <FloatingBulkActionBar
        selectedCount={selectedOrderIds.length}
        onClearSelection={() => setSelectedOrderIds([])}
        onDispatch={handleBulkDispatch}
        onDeleteSelected={() => setBulkDeleteOpen(true)}
        dispatching={dispatchingBulk}
        deleting={deletingBulk}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 pb-20"
      >
        <OrdersHeader
          loading={loading}
          syncing={syncing}
          onRefresh={fetchOrders}
          onSyncCourier={handleSyncCourier}
          onCreateOrder={handleOpenCreate}
        />

        <OrdersSearchBar value={search} onChange={setSearch} />

        <OrdersTable
          orders={filteredOrders}
          loading={loading}
          selectedOrderIds={selectedOrderIds}
          onSelectOrder={handleSelectOrder}
          onSelectAll={handleSelectAll}
          onEdit={handleOpenEdit}
          onTrack={handleOpenTrack}
          onDelete={handleOpenDelete}
        />
      </motion.div>
    </>
  );
}

/**
 * Orders & Shipments page — displays all customer orders in a
 * searchable table with courier sync, manual order creation right sheet,
 * bulk dispatch, tracking and bulk deletion actions.
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
