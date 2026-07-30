"use client";

import { motion } from "framer-motion";
import { Users, Search, Filter, Download, UserCheck, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "../chatbots/[chatbotId]/activity/_components/lead-status-badge";

export default function LeadsPage() {
  const MOCK_LEADS = [
    { id: "LD-101", name: "Sajal Akand", phone: "+880 1894-927244", platform: "Facebook", tags: ["priority", "top_client"], orders: 3, totalSpent: "৳ 6,800" },
    { id: "LD-102", name: "Tanvir Hossain", phone: "+880 1712-345678", platform: "WhatsApp", tags: ["high_prospect"], orders: 1, totalSpent: "৳ 1,850" },
    { id: "LD-103", name: "Nusrat Jahan", phone: "+880 1911-223344", platform: "Instagram", tags: ["risky"], orders: 0, totalSpent: "৳ 0" },
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
            <Users className="w-6 h-6 text-primary" />
            Leads & Customer Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated customer profiling, AI lead tags, and contact export.
          </p>
        </div>

        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Contacts (CSV)
        </Button>
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leads by name, phone, platform or tag..."
            className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border/50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </Button>
      </div>

      {/* Leads Table */}
      <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border/40 text-xs uppercase font-semibold">
              <tr>
                <th className="p-4">Lead ID</th>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Platform</th>
                <th className="p-4">AI Lead Tags</th>
                <th className="p-4">Orders</th>
                <th className="p-4">Total Spent</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {MOCK_LEADS.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-mono font-semibold text-primary">{lead.id}</td>
                  <td className="p-4">
                    <p className="font-semibold text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.phone}</p>
                  </td>
                  <td className="p-4 capitalize text-muted-foreground">{lead.platform}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {lead.tags.map((t) => (
                        <LeadStatusBadge key={t} status={t} />
                      ))}
                    </div>
                  </td>
                  <td className="p-4 font-semibold">{lead.orders}</td>
                  <td className="p-4 font-bold text-foreground">{lead.totalSpent}</td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      <UserCheck className="w-3.5 h-3.5" />
                      View CRM
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
