"use client";

import { motion } from "framer-motion";
import { ShoppingBag, Search, Filter, Plus, Truck, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OrdersPage() {
  const MOCK_ORDERS = [
    { id: "ORD-9482", customer: "Sajal Akand", phone: "+880 1894-927244", items: "Neutral White Half Zip", total: "৳ 2,200", status: "Processing", courier: "Steadfast", date: "Just now" },
    { id: "ORD-9481", customer: "Tanvir Hossain", phone: "+880 1712-345678", items: "Classic Black Hoodie", total: "৳ 1,850", status: "Shipped", courier: "Pathao", date: "25 min ago" },
    { id: "ORD-9480", customer: "Nusrat Jahan", phone: "+880 1911-223344", items: "Summer Denim Jacket", total: "৳ 3,400", status: "Delivered", courier: "Steadfast", date: "2 hrs ago" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Orders & Shipments
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage customer orders, track courier dispatches, and trigger tracking updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Truck className="w-4 h-4" />
            Sync Courier Status
          </Button>
          <Button className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none">
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
            placeholder="Search by Order ID, Customer, Phone..."
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
            <thead className="bg-muted/50 text-muted-foreground border-b border-border/40 text-xs uppercase font-semibold">
              <tr>
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Item Details</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Courier</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {MOCK_ORDERS.map((ord) => (
                <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono font-semibold text-primary">{ord.id}</td>
                  <td className="p-4">
                    <p className="font-semibold text-foreground">{ord.customer}</p>
                    <p className="text-xs text-muted-foreground">{ord.phone}</p>
                  </td>
                  <td className="p-4 text-muted-foreground">{ord.items}</td>
                  <td className="p-4 font-bold text-foreground">{ord.total}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary border border-border">
                      <Truck className="w-3 h-3 text-muted-foreground" />
                      {ord.courier}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {ord.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      Details
                      <ArrowUpRight className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
