"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  CheckSquare,
  MessageSquare,
  FileText,
  TrendingUp,
  Link as LinkIcon,
  ShoppingBag,
  ExternalLink,
  Edit2,
  Check,
  X,
  Plus,
  Clock,
  AlertCircle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type LifecycleStage = "new" | "engaged" | "qualified" | "customer" | "repeat" | "lapsed";

interface ContactIdentity {
  id: string;
  channel: string;
  externalId: string;
  sessionId: string | null;
  verified: boolean;
}

interface Deal {
  dealId: string;
  title: string;
  amount: number | null;
  stage: string;
  expectedCloseDate: string | null;
  probability: number | null;
  createdAt: string;
}

interface Task {
  taskId: string;
  title: string;
  description: string | null;
  type: string;
  priority: string;
  status: string;
  dueAt: string | null;
  completedAt: string | null;
}

interface ContactDetails {
  contactId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  profilePhoto: string | null;
  lifecycleStage: LifecycleStage;
  source: string | null;
  assignedToUserId: string | null;
  primaryAddress: string | null;
  district: string | null;
  marketingConsent: boolean;
  smsConsent: boolean;
  buyingIntentScore: number | null;
  aiSummary: string[];
  createdAt: string;
  updatedAt: string;
  identities: ContactIdentity[];
  deals: Deal[];
  tasks: Task[];
}

interface TimelineActivity {
  id: string;
  eventType: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  actorUserId: string | null;
  createdAt: string;
}

const LIFECYCLE_OPTIONS: LifecycleStage[] = [
  "new",
  "engaged",
  "qualified",
  "customer",
  "repeat",
  "lapsed",
];

const STAGE_COLORS: Record<LifecycleStage, string> = {
  new: "bg-muted text-muted-foreground border-border",
  engaged: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  qualified: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  customer: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  repeat: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  lapsed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

export default function ContactProfilePage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const resolvedParams = use(params);
  const contactId = resolvedParams.contactId;
  const router = useRouter();

  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineActivity[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [formValues, setFormValues] = useState({
    phone: "",
    email: "",
    primaryAddress: "",
    district: "",
    source: "",
    marketingConsent: false,
    smsConsent: false,
  });
  const [savingOverview, setSavingOverview] = useState(false);

  // Create Task State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueAt, setNewTaskDueAt] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [creatingTask, setCreatingTask] = useState(false);

  // Create Deal State
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState("");
  const [newDealAmount, setNewDealAmount] = useState("");
  const [newDealStage, setNewDealStage] = useState("new");
  const [creatingDeal, setCreatingDeal] = useState(false);

  const fetchContact = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/crm/contacts/${contactId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Contact not found");
          router.push("/dashboard/contacts");
          return;
        }
        throw new Error("Failed to fetch contact");
      }
      const data = await res.json();
      setContact(data.contact);
      setNameInput(data.contact.name || "");
      setFormValues({
        phone: data.contact.phone || "",
        email: data.contact.email || "",
        primaryAddress: data.contact.primaryAddress || "",
        district: data.contact.district || "",
        source: data.contact.source || "",
        marketingConsent: data.contact.marketingConsent || false,
        smsConsent: data.contact.smsConsent || false,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error loading contact");
    } finally {
      setLoading(false);
    }
  }, [contactId, router]);

  const fetchTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);
      const res = await fetch(`/api/crm/contacts/${contactId}/timeline?limit=30`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.activities || []);
      }
    } catch {
      // silently fail
    } finally {
      setTimelineLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  const handleUpdateStage = async (stage: LifecycleStage) => {
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycleStage: stage }),
      });
      if (!res.ok) throw new Error("Failed to update lifecycle stage");
      toast.success(`Lifecycle updated to ${stage}`);
      setContact((prev) => (prev ? { ...prev, lifecycleStage: stage } : null));
      fetchTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stage update failed");
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput === contact?.name) {
      setIsEditingName(false);
      return;
    }
    try {
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update name");
      toast.success("Name updated");
      setContact((prev) => (prev ? { ...prev, name: nameInput.trim() } : null));
      setIsEditingName(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update name");
    }
  };

  const handleSaveOverview = async () => {
    try {
      setSavingOverview(true);
      const res = await fetch(`/api/crm/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      toast.success("Contact properties saved successfully");
      fetchContact();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingOverview(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      setCreatingTask(true);
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          contactId,
          dueAt: newTaskDueAt ? new Date(newTaskDueAt).toISOString() : undefined,
          priority: newTaskPriority,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      toast.success("Task created");
      setIsTaskModalOpen(false);
      setNewTaskTitle("");
      setNewTaskDueAt("");
      fetchContact();
      fetchTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreatingTask(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) throw new Error("Failed to complete task");
      toast.success("Task marked completed");
      fetchContact();
      fetchTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to complete task");
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealTitle.trim()) return;
    try {
      setCreatingDeal(true);
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newDealTitle.trim(),
          contactId,
          amount: newDealAmount ? parseFloat(newDealAmount) : undefined,
          stage: newDealStage,
        }),
      });
      if (!res.ok) throw new Error("Failed to create deal");
      toast.success("Deal created");
      setIsDealModalOpen(false);
      setNewDealTitle("");
      setNewDealAmount("");
      fetchContact();
      fetchTimeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create deal");
    } finally {
      setCreatingDeal(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-4 items-center">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contact) return null;

  const activeSessionId = contact.identities.find((i) => i.sessionId)?.sessionId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-6xl mx-auto p-4 md:p-6"
    >
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/dashboard/contacts")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contacts
        </Button>
        <div className="flex items-center gap-2">
          {activeSessionId && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => router.push(`/dashboard/inbox?session=${activeSessionId}`)}
            >
              <ExternalLink className="w-4 h-4" />
              Open Live Chat
            </Button>
          )}
          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-none"
            onClick={() => setIsDealModalOpen(true)}
          >
            <Briefcase className="w-4 h-4" />
            Create Deal
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => setIsTaskModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <Card className="border-border/60 bg-card shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start md:items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={contact.profilePhoto || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                  {contact.name?.charAt(0).toUpperCase() || "C"}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="h-8 text-lg font-bold w-48"
                        autoFocus
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName}>
                        <Check className="w-4 h-4 text-emerald-500" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => setIsEditingName(false)}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                        {contact.name || "Unnamed Contact"}
                      </h1>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  <Select
                    value={contact.lifecycleStage}
                    onValueChange={(val) => handleUpdateStage(val as LifecycleStage)}
                  >
                    <SelectTrigger
                      className={`h-7 px-2.5 rounded-full text-xs font-semibold capitalize border ${
                        STAGE_COLORS[contact.lifecycleStage]
                      }`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE_OPTIONS.map((stg) => (
                        <SelectItem key={stg} value={stg} className="capitalize text-xs">
                          {stg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" /> {contact.phone}
                    </span>
                  )}
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" /> {contact.email}
                    </span>
                  )}
                  {contact.district && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> {contact.district}
                    </span>
                  )}
                </div>

                {/* Channel badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {contact.identities.map((id) => (
                    <Badge
                      key={id.id}
                      variant="secondary"
                      className="text-[11px] capitalize px-2 py-0.5 gap-1 font-medium bg-muted/60"
                    >
                      <LinkIcon className="w-3 h-3 text-primary" />
                      {id.channel}: {id.externalId.slice(0, 10)}...
                    </Badge>
                  ))}
                  {contact.identities.length === 0 && (
                    <span className="text-xs text-muted-foreground">No channels connected</span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats Block */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-6 shrink-0">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-medium">Deals</span>
                <p className="text-lg font-bold text-foreground">{contact.deals.length}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-medium">Open Tasks</span>
                <p className="text-lg font-bold text-foreground">
                  {contact.tasks.filter((t) => t.status !== "done").length}
                </p>
              </div>
              <div className="space-y-0.5 col-span-2 md:col-span-1">
                <span className="text-xs text-muted-foreground font-medium">Buying Intent</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-blue-600 rounded-full"
                      style={{ width: `${contact.buyingIntentScore || 50}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold">{contact.buyingIntentScore || 50}%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Details Tabs */}
      <Tabs defaultValue="overview" className="space-y-4" onValueChange={(val) => {
        if (val === "timeline") fetchTimeline();
      }}>
        <TabsList className="bg-muted/40 p-1 border border-border/40">
          <TabsTrigger value="overview" className="gap-2 text-xs md:text-sm">
            <User className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2 text-xs md:text-sm">
            <Clock className="w-4 h-4" />
            Timeline & Activity
          </TabsTrigger>
          <TabsTrigger value="deals-tasks" className="gap-2 text-xs md:text-sm">
            <Briefcase className="w-4 h-4" />
            Deals & Tasks ({contact.deals.length + contact.tasks.length})
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-2 text-xs md:text-sm">
            <ShoppingBag className="w-4 h-4" />
            Orders
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview Form */}
        <TabsContent value="overview">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-bold">Contact Details & Communication</CardTitle>
              <CardDescription>
                Editable customer properties, delivery address, and messaging consent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input
                    value={formValues.phone}
                    onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
                    placeholder="+8801700000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    value={formValues.email}
                    onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                    placeholder="customer@domain.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Primary Delivery Address</Label>
                  <Input
                    value={formValues.primaryAddress}
                    onChange={(e) => setFormValues({ ...formValues, primaryAddress: e.target.value })}
                    placeholder="House, Road, Area..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>District / Region</Label>
                  <Input
                    value={formValues.district}
                    onChange={(e) => setFormValues({ ...formValues, district: e.target.value })}
                    placeholder="Dhaka, Chittagong, Sylhet..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Input
                    value={formValues.source}
                    onChange={(e) => setFormValues({ ...formValues, source: e.target.value })}
                    placeholder="facebook, whatsapp, manual..."
                  />
                </div>
              </div>

              {/* Consent Section */}
              <div className="border-t border-border/50 pt-5 space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Communication Consent</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Marketing Consent</Label>
                      <p className="text-xs text-muted-foreground">
                        Customer agreed to receive automated marketing broadcasts
                      </p>
                    </div>
                    <Switch
                      checked={formValues.marketingConsent}
                      onCheckedChange={(val) =>
                        setFormValues({ ...formValues, marketingConsent: val })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">SMS Consent</Label>
                      <p className="text-xs text-muted-foreground">
                        Customer opted in for direct SMS updates & tracking notifications
                      </p>
                    </div>
                    <Switch
                      checked={formValues.smsConsent}
                      onCheckedChange={(val) => setFormValues({ ...formValues, smsConsent: val })}
                    />
                  </div>
                </div>
              </div>

              {/* AI Summaries */}
              {contact.aiSummary.length > 0 && (
                <div className="border-t border-border/50 pt-5 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">AI Intelligence Insights</h4>
                  <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                    {contact.aiSummary.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSaveOverview}
                  disabled={savingOverview}
                  className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white border-none"
                >
                  <Save className="w-4 h-4" />
                  {savingOverview ? "Saving..." : "Save Properties"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Timeline */}
        <TabsContent value="timeline">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Unified Activity Timeline</CardTitle>
                <CardDescription>
                  Chronological history of interactions, deals, tasks, and system events.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={fetchTimeline} disabled={timelineLoading}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {timelineLoading ? (
                <div className="space-y-4 py-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                  <Clock className="w-8 h-8 mx-auto opacity-40" />
                  <p>No activity records logged for this contact yet.</p>
                </div>
              ) : (
                <div className="relative border-l border-border/60 ml-4 pl-6 space-y-6 py-2">
                  {timeline.map((act) => (
                    <div key={act.id} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-primary ring-4 ring-background" />

                      <div className="rounded-lg border border-border/50 bg-card p-3 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold uppercase tracking-wider text-primary">
                            {act.eventType.replace(/_/g, " ")}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(act.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{act.summary || "System activity recorded"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Deals & Tasks */}
        <TabsContent value="deals-tasks">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deals Section */}
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Associated Deals</CardTitle>
                  <CardDescription>Active sales pipeline opportunities</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsDealModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  New Deal
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.deals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No deals created yet.</p>
                ) : (
                  contact.deals.map((deal) => (
                    <div
                      key={deal.dealId}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{deal.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {deal.stage}
                          </Badge>
                          {deal.amount && (
                            <span className="font-bold text-foreground">
                              ৳{deal.amount.toLocaleString("en-BD")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push("/dashboard/deals")}
                      >
                        View
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Tasks Section */}
            <Card className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Tasks & Follow-ups</CardTitle>
                  <CardDescription>Next actions and reminders</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setIsTaskModalOpen(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Add Task
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {contact.tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No tasks recorded.</p>
                ) : (
                  contact.tasks.map((task) => (
                    <div
                      key={task.taskId}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        task.status === "done"
                          ? "bg-muted/20 border-border/30 opacity-60"
                          : "bg-card border-border/50"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-sm font-semibold ${
                              task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {task.title}
                          </h4>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {task.priority}
                          </Badge>
                        </div>
                        {task.dueAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Due {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {task.status !== "done" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700"
                          onClick={() => handleCompleteTask(task.taskId)}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Done
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Orders */}
        <TabsContent value="orders">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-bold">Order History</CardTitle>
              <CardDescription>
                Orders linked to this contact.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                <ShoppingBag className="w-8 h-8 mx-auto opacity-40" />
                <p>Social commerce order tracking linked via customer phone & session.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/dashboard/orders")}
                >
                  View All Orders
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Creation Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create CRM Follow-up Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="e.g. Call customer regarding invoice"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newTaskPriority} onValueChange={(val) => setNewTaskPriority(val || "medium")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newTaskDueAt}
                  onChange={(e) => setNewTaskDueAt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTaskModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingTask}>
                {creatingTask ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deal Creation Modal */}
      <Dialog open={isDealModalOpen} onOpenChange={setIsDealModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sales Deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDeal} className="space-y-4">
            <div className="space-y-2">
              <Label>Deal Title *</Label>
              <Input
                value={newDealTitle}
                onChange={(e) => setNewDealTitle(e.target.value)}
                placeholder="e.g. Bulk Winter Collection Purchase"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Value (BDT)</Label>
                <Input
                  type="number"
                  value={newDealAmount}
                  onChange={(e) => setNewDealAmount(e.target.value)}
                  placeholder="৳5,000"
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Stage</Label>
                <Select value={newDealStage} onValueChange={(val) => setNewDealStage(val || "new")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDealModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingDeal}>
                {creatingDeal ? "Creating..." : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
