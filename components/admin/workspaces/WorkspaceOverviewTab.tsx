"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Calendar, Globe, Mail, Shield, User as UserIcon, CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface WorkspaceDetailData {
  workspace: {
    id: string;
    workspaceId: string;
    name: string;
    logoUrl?: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  owner: {
    id: string;
    userId: string;
    name: string;
    email: string;
    picture?: string | null;
    plan: string;
    region: string;
    role: string;
    creditsBalance: number;
    includedCredits: number;
    creditsUsedThisCycle: number;
    createdAt: string;
  };
  chatbots: Array<{
    id: string;
    chatbotId: string;
    name: string;
    model: string;
    avatar?: string | null;
    chatbotMode: string;
    createdAt: string;
    messageCount: number;
    sessionCount: number;
  }>;
}

interface WorkspaceOverviewTabProps {
  data: WorkspaceDetailData;
  onRefresh: () => void;
}

export function WorkspaceOverviewTab({ data, onRefresh }: WorkspaceOverviewTabProps) {
  const { t } = useTranslation("admin");
  const [statusLoading, setStatusLoading] = useState(false);

  const handleStatusChange = async (newStatus: "active" | "warning" | "suspended") => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${data.workspace.workspaceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", status: newStatus }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update status");

      toast.success(resData.message || `Status updated to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  const currentStatus = data.workspace.status || "active";

  return (
    <div className="space-y-6">
      {/* Grid of Owner & Workspace Metadata */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Workspace Metadata Card */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {t("workspaces.overview.metaTitle", "Workspace System Information")}
            </CardTitle>
            <CardDescription>{t("workspaces.overview.metaDesc", "Unique identifiers and platform configuration")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <span className="text-muted-foreground">{t("workspaces.overview.workspaceId", "Workspace ID")}</span>
              <span className="font-mono text-xs font-semibold bg-muted/50 px-2 py-1 rounded-md">{data.workspace.workspaceId}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <span className="text-muted-foreground">{t("workspaces.overview.created", "Created Date")}</span>
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{new Date(data.workspace.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <span className="text-muted-foreground">{t("workspaces.overview.region", "Region")}</span>
              <div className="flex items-center gap-1.5 font-medium uppercase">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{data.owner.region || "bd"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">{t("workspaces.overview.statusToggle", "Status Control")}</span>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={currentStatus === "active" ? "default" : "outline"}
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("active")}
                  className={cn("h-8 rounded-lg text-xs", currentStatus === "active" && "bg-emerald-600 hover:bg-emerald-700")}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active
                </Button>
                <Button
                  size="sm"
                  variant={currentStatus === "warning" ? "default" : "outline"}
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("warning")}
                  className={cn("h-8 rounded-lg text-xs", currentStatus === "warning" && "bg-amber-600 hover:bg-amber-700")}
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Warning
                </Button>
                <Button
                  size="sm"
                  variant={currentStatus === "suspended" ? "default" : "outline"}
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("suspended")}
                  className={cn("h-8 rounded-lg text-xs", currentStatus === "suspended" && "bg-rose-600 hover:bg-rose-700")}
                >
                  <AlertOctagon className="mr-1 h-3 w-3" />
                  Suspended
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Owner Profile Card */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-primary" />
              {t("workspaces.overview.ownerTitle", "Workspace Owner")}
            </CardTitle>
            <CardDescription>{t("workspaces.overview.ownerDesc", "Account owner profile & permissions")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                <AvatarImage src={data.owner.picture || undefined} />
                <AvatarFallback className="bg-brand-gradient text-white text-base font-bold">
                  {data.owner.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-bold text-foreground text-base flex items-center gap-2">
                  {data.owner.name}
                  {data.owner.role !== "user" && (
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {data.owner.role}
                    </Badge>
                  )}
                </h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  {data.owner.email}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="capitalize text-xs border-primary/20">
                    {data.owner.plan} Plan
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Joined {new Date(data.owner.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected Chatbots List */}
      <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              {t("workspaces.overview.chatbotsTitle", "Connected AI Agents")} ({data.chatbots.length})
            </CardTitle>
            <CardDescription>{t("workspaces.overview.chatbotsDesc", "Active chatbots deployed in this workspace")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!data.chatbots.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No chatbots created in this workspace yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.chatbots.map((cb) => (
                <div key={cb.id} className="flex items-start gap-3 rounded-xl border border-primary/10 bg-background/50 p-4 transition-all hover:border-primary/30">
                  <Avatar className="h-10 w-10 shrink-0 ring-1 ring-primary/20">
                    <AvatarImage src={cb.avatar || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                      {cb.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-semibold text-sm truncate text-foreground">{cb.name}</h5>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{cb.model || "Default Model"}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{cb.messageCount.toLocaleString()} msgs</span>
                      <span>•</span>
                      <span>{cb.sessionCount.toLocaleString()} sessions</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
