"use client";

import { ShoppingBag, RefreshCw, Plus, Truck, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface OrdersHeaderProps {
    loading: boolean;
    syncing: boolean;
    lastSyncedAt?: Date | null;
    onRefresh: () => void;
    onSyncCourier: () => void;
    onCreateOrder: () => void;
}

/**
 * Page header with title, description, and action buttons
 * (Refresh, Sync Courier, Create Manual Order).
 */
export function OrdersHeader({
    loading,
    syncing,
    lastSyncedAt,
    onRefresh,
    onSyncCourier,
    onCreateOrder,
}: OrdersHeaderProps) {
    const { t } = useTranslation("orders");

    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <ShoppingBag className="w-6 h-6 text-primary" />
                    Orders & Shipments
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage customer orders, track courier dispatches, and trigger tracking
                    updates.
                </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    className="gap-2 cursor-pointer"
                >
                    <RefreshCw
                        className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                    />
                    Refresh
                </Button>

                <Button
                    variant="outline"
                    className="gap-2 cursor-pointer"
                    onClick={onSyncCourier}
                    disabled={syncing}
                >
                    <Truck className={`w-4 h-4 ${syncing ? "animate-bounce" : ""}`} />
                    {syncing ? t("syncStatus.syncing", "Syncing...") : t("buttons.syncCourier", "Sync Courier Status")}
                </Button>
                {lastSyncedAt && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-primary" />
                        {t("syncStatus.lastSynced", "Last synced")}: {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                )}

                <Button
                    className="gap-2 bg-brand-gradient hover:opacity-90 text-white border-none cursor-pointer"
                    onClick={onCreateOrder}
                >
                    <Plus className="w-4 h-4" />
                    Create Manual Order
                </Button>
            </div>
        </div>
    );
}
