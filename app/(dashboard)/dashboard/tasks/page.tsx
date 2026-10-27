"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckSquare,
  Plus,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Filter,
  User,
  Briefcase,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface TaskContact {
  contactId: string;
  name: string | null;
  phone: string | null;
}

interface TaskDeal {
  dealId: string;
  title: string;
}

interface CrmTaskItem {
  taskId: string;
  title: string;
  description: string | null;
  type: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "done" | "cancelled" | "overdue";
  dueAt: string | null;
  completedAt: string | null;
  assignedToUserId: string | null;
  contactId: string | null;
  dealId: string | null;
  createdAt: string;
  contact: TaskContact | null;
  deal: TaskDeal | null;
}

const PRIORITY_BADGES: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  urgent: "bg-rose-500/10 text-rose-500 border-rose-500/20",
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<CrmTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");

  // Create Task Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("follow_up");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueAt, setDueAt] = useState("");
  const [contactId, setContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactOptions, setContactOptions] = useState<Array<{ contactId: string; name: string | null; phone: string | null }>>([]);
  const [creating, setCreating] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (tab === "dueToday") params.set("dueToday", "true");
      if (tab === "overdue") params.set("overdue", "true");
      if (tab === "done") params.set("status", "done");

      const res = await fetch(`/api/crm/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      toast.error("Failed to load CRM tasks");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Search contacts for creating task
  useEffect(() => {
    if (!contactSearch.trim()) return;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/contacts?search=${encodeURIComponent(contactSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setContactOptions(data.contacts || []);
        }
      } catch {
        // silent
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const handleComplete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      if (!res.ok) throw new Error("Failed to complete task");
      toast.success("Task completed");
      setTasks((prev) =>
        prev.map((t) => (t.taskId === taskId ? { ...t, status: "done", completedAt: new Date().toISOString() } : t))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error completing task");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type: taskType,
          priority,
          dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
          contactId: contactId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create task");
      toast.success("Task created successfully");
      setIsCreateOpen(false);
      setTitle("");
      setDescription("");
      setDueAt("");
      setContactId("");
      fetchTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  };

  const pendingCount = tasks.filter((t) => t.status !== "done").length;
  const overdueCount = tasks.filter(
    (t) => t.status !== "done" && t.dueAt && new Date(t.dueAt).getTime() < Date.now()
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-5xl mx-auto p-4 md:p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" />
            CRM Tasks & Follow-ups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay on top of customer follow-ups, calls, and sales actions.
          </p>
        </div>

        <Button
          size="sm"
          className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-none shadow-xs"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={setTab} className="w-full sm:w-auto">
          <TabsList className="bg-muted/40 p-1 border border-border/40">
            <TabsTrigger value="all" className="text-xs md:text-sm">
              All Tasks
            </TabsTrigger>
            <TabsTrigger value="dueToday" className="text-xs md:text-sm">
              Due Today
            </TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs md:text-sm gap-1.5 text-rose-500">
              Overdue
              {overdueCount > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {overdueCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="done" className="text-xs md:text-sm">
              Completed
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tasks List */}
      <Card className="border-border/60">
        <CardContent className="p-4 sm:p-6 space-y-3">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm space-y-2">
              <CheckSquare className="w-10 h-10 mx-auto opacity-30" />
              <p>No tasks found in this view.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {tasks.map((task) => {
                const isOverdue =
                  task.status !== "done" &&
                  task.dueAt &&
                  new Date(task.dueAt).getTime() < Date.now();

                return (
                  <div
                    key={task.taskId}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      task.status === "done" ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => handleComplete(task.taskId)}
                        disabled={task.status === "done"}
                        className={`mt-1 h-5 w-5 rounded-md border flex items-center justify-center transition-colors ${
                          task.status === "done"
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border hover:border-primary"
                        }`}
                      >
                        {task.status === "done" && <CheckCircle2 className="w-4 h-4" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`font-semibold text-sm ${
                              task.status === "done"
                                ? "line-through text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {task.title}
                          </h4>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-bold ${
                              PRIORITY_BADGES[task.priority]
                            }`}
                          >
                            {task.priority}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {task.type.replace(/_/g, " ")}
                          </Badge>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {task.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-0.5">
                          {task.contact && (
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/contacts/${task.contactId}`)}
                              className="flex items-center gap-1 hover:text-primary transition-colors font-medium text-foreground"
                            >
                              <User className="w-3 h-3 text-primary" />
                              {task.contact.name || "Unnamed Contact"}
                            </button>
                          )}
                          {task.dueAt && (
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue ? "text-rose-500 font-semibold" : ""
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {isOverdue ? "Overdue: " : "Due: "}
                              {new Date(task.dueAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {task.status !== "done" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                          onClick={() => handleComplete(task.taskId)}
                        >
                          Mark Done
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create CRM Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Follow up on WhatsApp order inquiry"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={taskType} onValueChange={(val) => setTaskType(val || "follow_up")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp Message</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(val) => setPriority(val as "low" | "medium" | "high" | "urgent")}
                >
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
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </div>

            {/* Contact selector */}
            <div className="space-y-2">
              <Label>Link to Contact (Optional)</Label>
              <Input
                placeholder="Search contact..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
              {contactOptions.length > 0 && (
                <div className="max-h-32 overflow-y-auto border border-border/60 rounded-md p-1 bg-card space-y-1">
                  {contactOptions.map((c) => (
                    <div
                      key={c.contactId}
                      className={`p-2 rounded text-xs cursor-pointer flex justify-between ${
                        contactId === c.contactId ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setContactId(c.contactId);
                        setContactSearch(c.name || c.phone || c.contactId);
                        setContactOptions([]);
                      }}
                    >
                      <span>{c.name || "Unnamed"}</span>
                      <span className="text-muted-foreground">{c.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Description / Note</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes for your team..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
