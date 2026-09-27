"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Download,
  Filter,
  Search,
  ShoppingBag,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CustomerCrmDrawer,
  type CustomerLead,
  type StaffNote,
} from "@/components/crm/CustomerCrmDrawer";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
  WebsiteWidgetIcon,
} from "@/components/icons/PlatformIcons";
import { LeadStatusBadge } from "../chatbots/[chatbotId]/activity/_components/lead-status-badge";

type ChatbotOption = {
  id: string;
  chatbotId: string;
  name: string;
};

type CrmStats = {
  totalContacts: number;
  highProspects: number;
  payingCustomers: number;
  totalRevenue: number;
};

type CrmCustomersResponse = {
  stats: CrmStats;
  customers: CustomerLead[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
};

const DEFAULT_STATS: CrmStats = {
  totalContacts: 0,
  highProspects: 0,
  payingCustomers: 0,
  totalRevenue: 0,
};

const DEFAULT_LIMIT = 10;

const platformOptions = [
  { value: "", label: "All Platforms" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
];

const tagOptions = [
  { value: "", label: "All AI Tags" },
  { value: "priority", label: "Priority" },
  { value: "high_prospect", label: "High Prospect" },
  { value: "risky", label: "Risky" },
  { value: "top_client", label: "Top Client" },
];

function formatCurrency(value: number) {
  return `৳${Math.round(value || 0).toLocaleString("en-BD")}`;
}

function leadBadge(index: number, page: number) {
  return `LD-${100 + (page - 1) * DEFAULT_LIMIT + index + 1}`;
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function getPlatformIcon(platform: string) {
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
        className="h-9 w-9 rounded-full border border-border/50 object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
      {(customer.guestName || "C").charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({
  title,
  value,
  Icon,
}: {
  title: string;
  value: string | number;
  Icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="animate-pulse">
          {Array.from({ length: 7 }).map((__, cellIndex) => (
            <td key={cellIndex} className="p-4">
              <div className="h-4 rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialPage = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
  const [chatbots, setChatbots] = useState<ChatbotOption[]>([]);
  const [selectedChatbotId, setSelectedChatbotId] = useState(searchParams.get("botId") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [platform, setPlatform] = useState(searchParams.get("platform") || "");
  const [tag, setTag] = useState(searchParams.get("tag") || "");
  const [page, setPage] = useState(initialPage);
  const [stats, setStats] = useState<CrmStats>(DEFAULT_STATS);
  const [customers, setCustomers] = useState<CustomerLead[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLead | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const updateUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedChatbotId) params.set("botId", selectedChatbotId);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (platform) params.set("platform", platform);
    if (tag) params.set("tag", tag);
    if (page > 1) params.set("page", String(page));

    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [debouncedSearch, page, pathname, platform, router, selectedChatbotId, tag]);

  useEffect(() => {
    updateUrl();
  }, [updateUrl]);

  useEffect(() => {
    async function loadChatbots() {
      try {
        const res = await fetch("/api/chatbots");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data)) throw new Error("Failed to load AI Agents");

        setChatbots(data);
        setSelectedChatbotId((current) => current || data[0]?.chatbotId || "");
      } catch {
        toast.error("Failed to load AI Agents.");
        setLoading(false);
      }
    }

    void loadChatbots();
  }, []);

  const loadCustomers = useCallback(async () => {
    if (!selectedChatbotId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        chatbotId: selectedChatbotId,
        page: String(page),
        limit: String(DEFAULT_LIMIT),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (platform) params.set("platform", platform);
      if (tag) params.set("tag", tag);

      const res = await fetch(`/api/crm/customers?${params.toString()}`);
      const data = (await res.json()) as CrmCustomersResponse;
      if (!res.ok) throw new Error("Failed to load CRM customers");

      setStats(data.stats || DEFAULT_STATS);
      setCustomers(data.customers || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error("Failed to load CRM customers.");
      setStats(DEFAULT_STATS);
      setCustomers([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, platform, selectedChatbotId, tag]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const metricCards = useMemo(
    () => [
      { title: "Total Contacts", value: stats.totalContacts, Icon: Users },
      { title: "High Prospects", value: stats.highProspects, Icon: Sparkles },
      { title: "Paying Customers", value: stats.payingCustomers, Icon: ShoppingBag },
      { title: "Customer LTV Revenue", value: formatCurrency(stats.totalRevenue), Icon: Wallet },
    ],
    [stats]
  );

  const exportCsv = () => {
    if (customers.length === 0) {
      toast.error("No contacts to export.");
      return;
    }

    const rows = [
      ["Lead ID", "Customer Name", "Phone", "Platform", "AI Tags", "Orders", "Total Spent", "Last Active"],
      ...customers.map((customer, index) => [
        leadBadge(index, page),
        customer.guestName,
        customer.phone || "",
        customer.platform,
        customer.aiTags.join("; "),
        customer.totalOrders,
        customer.totalSpent,
        customer.lastActive,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `crm-customers-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Contacts exported.");
  };

  const handleSelectChatbot = (value: string) => {
    setSelectedChatbotId(value);
    setPage(1);
  };

  const handleSelectPlatform = (value: string) => {
    setPlatform(value);
    setPage(1);
  };

  const handleSelectTag = (value: string) => {
    setTag(value);
    setPage(1);
  };

  const handleNoteAdded = (sessionId: string, notes: StaffNote[]) => {
    setCustomers((currentCustomers) =>
      currentCustomers.map((customer) =>
        customer.id === sessionId ? { ...customer, staffNotes: notes } : customer
      )
    );
    setSelectedCustomer((currentCustomer) =>
      currentCustomer && currentCustomer.id === sessionId
        ? { ...currentCustomer, staffNotes: notes }
        : currentCustomer
    );
  };

  const currentStart = total === 0 ? 0 : (page - 1) * DEFAULT_LIMIT + 1;
  const currentEnd = Math.min(page * DEFAULT_LIMIT, total);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-7xl space-y-6 pb-12"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Users className="h-6 w-6 text-primary" />
            Leads & Customer Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automated customer profiling, AI lead tags, order history, and contact export.
          </p>
        </div>

        <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={loading || customers.length === 0}>
          <Download className="h-4 w-4" />
          Export Contacts (CSV)
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-3 shadow-xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search leads by name, phone, or session ID..."
              className="w-full rounded-lg border border-border/50 bg-muted/40 py-2 pl-9 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedChatbotId}
              onChange={(event) => handleSelectChatbot(event.target.value)}
              className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
              {chatbots.length === 0 ? (
                <option value="">No AI Agent</option>
              ) : (
                chatbots.map((bot) => (
                  <option key={bot.chatbotId} value={bot.chatbotId}>
                    {bot.name}
                  </option>
                ))
              )}
            </select>

            <select
              value={platform}
              onChange={(event) => handleSelectPlatform(event.target.value)}
              className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
              {platformOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={tag}
              onChange={(event) => handleSelectTag(event.target.value)}
              className="h-10 rounded-lg border border-border/60 bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
              {tagOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <Button variant="outline" size="sm" className="h-10 gap-2" onClick={() => void loadCustomers()}>
              <Filter className="h-3.5 w-3.5" />
              Apply
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/40 bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
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
              {loading ? (
                <TableSkeleton />
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">
                    No customer leads found for the current filters.
                  </td>
                </tr>
              ) : (
                customers.map((customer, index) => {
                  const badge = leadBadge(index, page);
                  return (
                    <tr key={customer.id} className="transition-colors hover:bg-muted/30">
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary transition hover:bg-primary/15"
                        >
                          {badge}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar customer={customer} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{customer.guestName}</p>
                            <p className="text-xs text-muted-foreground">{customer.phone || "No phone captured"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <PlatformBadge platform={customer.platform} />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {customer.aiTags.length > 0 ? (
                            customer.aiTags.map((aiTag) => (
                              <LeadStatusBadge key={aiTag} status={aiTag} />
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">No tags</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-foreground">{customer.totalOrders}</td>
                      <td className="p-4 font-bold text-foreground">{formatCurrency(customer.totalSpent)}</td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          View CRM
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {currentStart}-{currentEnd} of {total} contacts
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <CustomerCrmDrawer
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onNoteAdded={handleNoteAdded}
      />
    </motion.div>
  );
}
