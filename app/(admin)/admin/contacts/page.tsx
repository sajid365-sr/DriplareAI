"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CheckCircle2,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  source: string;
  status: string;
  createdAt: string;
};

type ContactsResponse = {
  submissions: ContactSubmission[];
  pagination: { page: number; totalPages: number; total: number };
  stats: { new: number; read: number; replied: number; archived: number; total: number };
};

const STATUS_OPTIONS = ["all", "new", "read", "replied", "archived"] as const;

function statusVariant(status: string) {
  switch (status) {
    case "new":
      return "default";
    case "read":
      return "secondary";
    case "replied":
      return "outline";
    default:
      return "secondary";
  }
}

export default function AdminContactsPage() {
  const { t } = useTranslation("admin");
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ContactSubmission | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/contacts?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      setData(await res.json());
    } catch {
      toast.error(t("contacts.loadError"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(t("contacts.statusUpdated"));
      setSelected((prev) => (prev?.id === id ? { ...prev, status } : prev));
      await fetchContacts();
    } catch {
      toast.error(t("contacts.updateError"));
    } finally {
      setUpdating(false);
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!confirm(t("contacts.deleteConfirm"))) return;

    try {
      const res = await fetch(`/api/admin/contacts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(t("contacts.deleted"));
      setSelected(null);
      await fetchContacts();
    } catch {
      toast.error(t("contacts.deleteError"));
    }
  };

  const statCards = [
    { key: "new", label: t("contacts.stats.new"), value: data?.stats.new ?? 0, icon: Inbox },
    { key: "read", label: t("contacts.stats.read"), value: data?.stats.read ?? 0, icon: Mail },
    { key: "replied", label: t("contacts.stats.replied"), value: data?.stats.replied ?? 0, icon: CheckCircle2 },
    { key: "total", label: t("contacts.stats.total"), value: data?.stats.total ?? 0, icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("contacts.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("contacts.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] rounded-xl">
              <SelectValue placeholder={t("contacts.filterStatus")} />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`contacts.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchContacts} className="rounded-xl">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(({ key, label, value, icon: Icon }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-primary/10 bg-card/60 p-4 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </motion.div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/40">
        {loading && !data ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("contacts.loading")}</div>
        ) : !data?.submissions.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("contacts.empty")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.submissions.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-primary/5 md:px-6"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{item.name}</span>
                      <Badge variant={statusVariant(item.status) as "default"}>
                        {t(`contacts.status.${item.status}`, item.status)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {item.source}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.email}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/80">{item.message}</p>
                  </div>
                  <time className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </time>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>{selected.email}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {selected.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {selected.phone}
                  </div>
                )}
                <div className="rounded-xl bg-muted/40 p-4 whitespace-pre-wrap text-foreground">
                  {selected.message}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["read", "replied", "archived"] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selected.status === s ? "default" : "outline"}
                      disabled={updating || selected.status === s}
                      onClick={() => updateStatus(selected.id, s)}
                      className="rounded-full"
                    >
                      {s === "archived" && <Archive className="mr-1.5 h-3.5 w-3.5" />}
                      {t(`contacts.status.${s}`)}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteSubmission(selected.id)}
                    className="rounded-full"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t("contacts.delete")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
