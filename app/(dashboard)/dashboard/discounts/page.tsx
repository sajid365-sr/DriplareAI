"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    Plus,
    Tag,
    Percent,
    Banknote,
    ShoppingCart,
    Pencil,
    Trash2,
    Sparkles,
    TicketPercent,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    CreateCouponModal,
    type Coupon,
    type DiscountType,
} from "@/components/discounts/CreateCouponModal";

/** Mock seed data for the placeholder UI. */
const seedCoupons: Coupon[] = [
    { id: "1", code: "EID2026", type: "percentage", value: 15, minOrder: 1000, expiresAt: "2026-08-31", active: true, redemptions: 64, revenue: 18500 },
    { id: "2", code: "FREESHIP", type: "free_shipping", value: 0, minOrder: 500, expiresAt: "2026-12-31", active: true, redemptions: 52, revenue: 12400 },
    { id: "3", code: "WELCOME50", type: "fixed", value: 50, minOrder: 0, expiresAt: "2026-09-15", active: false, redemptions: 26, revenue: 14300 },
];

const TYPE_BADGE: Record<DiscountType, { label: string; className: string }> = {
    percentage: { label: "Percentage", className: "bg-primary/10 text-primary" },
    fixed: { label: "Fixed", className: "bg-fuchsia-500/10 text-fuchsia-500" },
    free_shipping: { label: "Free Shipping", className: "bg-emerald-500/10 text-emerald-500" },
};

/** Formats a discount value based on its type. */
function formatDiscount(c: Coupon): string {
    if (c.type === "percentage") return `${c.value}%`;
    if (c.type === "free_shipping") return "Free";
    return `৳${c.value}`;
}

function DiscountsContent() {
    const [coupons, setCoupons] = useState<Coupon[]>(seedCoupons);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Coupon | null>(null);

    // Summary stats derived from the live coupon list.
    const stats = useMemo(() => {
        const active = coupons.filter((c) => c.active).length;
        const redemptions = coupons.reduce((sum, c) => sum + c.redemptions, 0);
        const revenue = coupons.reduce((sum, c) => sum + c.revenue, 0);
        return { total: coupons.length, active, redemptions, revenue };
    }, [coupons]);

    const handleOpenCreate = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (coupon: Coupon) => {
        setEditing(coupon);
        setModalOpen(true);
    };

    const handleCreated = (coupon: Coupon) => {
        setCoupons((prev) => {
            const exists = prev.some((c) => c.id === coupon.id);
            return exists ? prev.map((c) => (c.id === coupon.id ? coupon : c)) : [coupon, ...prev];
        });
    };

    const handleToggle = (coupon: Coupon, checked: boolean) => {
        setCoupons((prev) => prev.map((c) => (c.id === coupon.id ? { ...c, active: checked } : c)));
        toast.success(`${coupon.code} ${checked ? "activated" : "deactivated"}`);
    };

    const handleDelete = (coupon: Coupon) => {
        setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
        toast.success(`Coupon ${coupon.code} deleted`);
    };

    const statCards = [
        {
            label: "Total Coupons",
            value: String(stats.total),
            sub: `${stats.active} Active`,
            icon: TicketPercent,
            accent: "from-primary/20 to-fuchsia-500/10 text-primary",
        },
        {
            label: "Total Redemptions",
            value: String(stats.redemptions),
            sub: "Used",
            icon: ShoppingCart,
            accent: "from-fuchsia-500/20 to-primary/10 text-fuchsia-500",
        },
        {
            label: "Revenue Generated",
            value: `৳ ${stats.revenue.toLocaleString("en-US")}`,
            sub: "From coupon orders",
            icon: Banknote,
            accent: "from-emerald-500/20 to-primary/10 text-emerald-500",
        },
    ];

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        Store Discounts & Coupons
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage promotional codes, seasonal offers, and AI auto-negotiation rules.
                    </p>
                </div>
                <Button
                    onClick={handleOpenCreate}
                    className="bg-brand-gradient hover:opacity-90 text-white border-none shadow-lg shadow-primary/20"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    Create Coupon
                </Button>
            </motion.div>

            {/* Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {statCards.map((card, i) => {
                    const Icon = card.icon;
                    return (
                        <motion.div
                            key={card.label}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.3 }}
                            className="rounded-2xl border border-border bg-gradient-to-br from-secondary/60 to-card p-4 relative overflow-hidden"
                        >
                            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none bg-gradient-to-br ${card.accent}`} />
                            <div className="flex items-center justify-between relative z-10">
                                <span className="text-xs font-semibold text-muted-foreground">{card.label}</span>
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${card.accent}`}>
                                    <Icon className="w-4 h-4" />
                                </span>
                            </div>
                            <div className="mt-2 relative z-10">
                                <span className="text-2xl font-bold text-foreground">{card.value}</span>
                                <span className="ml-2 text-xs font-medium text-muted-foreground">{card.sub}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Coupons Table */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className="rounded-2xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden"
            >
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Active Coupons
                    </h2>
                    <Badge variant="secondary" className="text-muted-foreground">
                        {coupons.length} total
                    </Badge>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Coupon Code</TableHead>
                            <TableHead>Discount</TableHead>
                            <TableHead>Min. Order</TableHead>
                            <TableHead>Expiry</TableHead>
                            <TableHead>Redemptions</TableHead>
                            <TableHead>Revenue</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {coupons.map((coupon, i) => {
                            const badge = TYPE_BADGE[coupon.type];
                            return (
                                <TableRow
                                    key={coupon.id}
                                    className="group hover:bg-muted/40 transition-colors"
                                >
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold text-foreground">{coupon.code}</span>
                                            <Badge className={badge.className}>{badge.label}</Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">
                                        {formatDiscount(coupon)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {coupon.minOrder > 0 ? `৳${coupon.minOrder}` : "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{coupon.redemptions}</TableCell>
                                    <TableCell className="font-medium text-foreground">
                                        ৳{coupon.revenue.toLocaleString("en-US")}
                                    </TableCell>
                                    <TableCell>
                                        <Switch
                                            checked={coupon.active}
                                            onCheckedChange={(checked) => handleToggle(coupon, checked)}
                                            aria-label={`Toggle ${coupon.code}`}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenEdit(coupon)}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                                aria-label={`Edit ${coupon.code}`}
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(coupon)}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                aria-label={`Delete ${coupon.code}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {coupons.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                    <Percent className="w-6 h-6 mx-auto mb-2 opacity-40" />
                                    No coupons yet. Create your first coupon to get started.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </motion.div>

            {/* Create / Edit Coupon Modal */}
            <AnimatePresence>
                {modalOpen && (
                    <CreateCouponModal
                        onClose={() => setModalOpen(false)}
                        onCreated={handleCreated}
                        initial={editing ?? undefined}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

export default function DiscountsPage() {
    return <DiscountsContent />;
}