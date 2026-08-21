"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Bot, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { AdminUserRow, UserEditDialog } from "@/components/admin/UserEditDialog";

type UsersResponse = {
  users: AdminUserRow[];
  pagination: { page: number; totalPages: number; total: number };
  stats: { total: number; byPlan: Record<string, number> };
  permissions: { canManageRoles: boolean };
};

export default function AdminUsersPage() {
  const { t } = useTranslation("admin");
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<AdminUserRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {
      toast.error(t("users.loadError"));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openEdit = (user: AdminUserRow) => {
    setSelected(user);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("users.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("users.description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearch(searchInput)}
              placeholder={t("users.searchPlaceholder")}
              className="w-56 rounded-xl pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => setSearch(searchInput)}
          >
            {t("users.search")}
          </Button>
          <Button variant="outline" size="icon" onClick={fetchUsers} className="rounded-xl">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/10 bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("users.stats.total")}</p>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{data?.stats.total ?? 0}</p>
        </div>
        {Object.entries(data?.stats.byPlan ?? {})
          .slice(0, 2)
          .map(([plan, count]) => (
            <div key={plan} className="rounded-2xl border border-primary/10 bg-card/60 p-4">
              <p className="text-xs font-medium capitalize text-muted-foreground">{plan}</p>
              <p className="mt-2 text-2xl font-bold">{count}</p>
            </div>
          ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/10 bg-card/40">
        {loading && !data ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("users.loading")}</div>
        ) : !data?.users.length ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("users.empty")}</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.users.map((user) => (
              <li key={user.userId}>
                <button
                  type="button"
                  onClick={() => openEdit(user)}
                  className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-primary/5 md:px-6"
                >
                  <Avatar className="h-10 w-10 ring-2 ring-primary/10">
                    <AvatarImage src={user.picture ?? undefined} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{user.name}</span>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {user.plan}
                      </Badge>
                      {user.role !== "user" && (
                        <Badge className="text-[10px]">{user.role}</Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {user.region}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{user.email}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {user._count.chatbots} AI Agents
                      </span>
                      <span>
                        {user.creditsBalance.toLocaleString()} credits
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <UserEditDialog
        user={selected}
        open={dialogOpen}
        canManageRoles={data?.permissions.canManageRoles ?? false}
        onOpenChange={setDialogOpen}
        onSaved={fetchUsers}
      />
    </div>
  );
}
