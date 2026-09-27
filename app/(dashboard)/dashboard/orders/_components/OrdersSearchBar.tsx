"use client";

import { Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrdersSearchBarProps {
    value: string;
    onChange: (value: string) => void;
}

/**
 * Search input and filter button for the orders table.
 */
export function OrdersSearchBar({ value, onChange }: OrdersSearchBarProps) {
    return (
        <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border/60">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by Order ID, Customer, Phone, Tracking..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
            </div>
            <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-3.5 h-3.5" />
                Filter
            </Button>
        </div>
    );
}
