"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Plus,
  Kanban,
  Table as TableIcon,
  Search,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  Filter,
  MoreVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

interface DealContact {
  contactId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

interface Deal {
  dealId: string;
  contactId: string;
  title: string;
  amount: number | null;
  currency: string;
  probability: number | null;
  stage: string;
  lostReason: string | null;
  expectedCloseDate: string | null;
  assignedToUserId: string | null;
  source: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  contact: DealContact;
}

const STAGES = [
  { id: "new", name: "New", color: "border-blue-500/30 bg-blue-500/5 text-blue-500" },
  { id: "contacted", name: "Contacted", color: "border-sky-500/30 bg-sky-500/5 text-sky-500" },
  { id: "qualified", name: "Qualified", color: "border-amber-500/30 bg-amber-500/5 text-amber-500" },
  { id: "proposal", name: "Proposal", color: "border-purple-500/30 bg-purple-500/5 text-purple-500" },
  { id: "negotiation", name: "Negotiation", color: "border-indigo-500/30 bg-indigo-500/5 text-indigo-500" },
  { id: "won", name: "Won", color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" },
  { id: "lost", name: "Lost", color: "border-rose-500/30 bg-rose-500/5 text-rose-500" },
];

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Selected Deal Detail Sheet
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [lostReasonInput, setLostReasonInput] = useState("");

  // Create Deal Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newStage, setNewStage] = useState("new");
  const [newCloseDate, setNewCloseDate] = useState("");
  const [newProbability, setNewProbability] = useState("50");
  const [newContactId, setNewContactId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactOptions, setContactOptions] = useState<Array<{ contactId: string; name: string | null; phone: string | null }>>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (stageFilter && stageFilter !== "all") params.set("stage", stageFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/crm/deals?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDeals(data.deals || []);
      }
    } catch {
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [stageFilter, search]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Search contacts for creation
  useEffect(() => {
    if (!contactSearch.trim()) return;
    const t = setTimeout(async () => {
      try {
        setSearchingContacts(true);
        const res = await fetch(`/api/crm/contacts?search=${encodeURIComponent(contactSearch)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setContactOptions(data.contacts || []);
        }
      } catch {
        // silent
      } finally {
        setSearchingContacts(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContactId) {
      toast.error("Title and Contact are required");
      return;
    }
    try {
      setCreating(true);
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          contactId: newContactId,
          amount: newAmount ? parseFloat(newAmount) : undefined,
          stage: newStage,
          probability: newProbability ? parseInt(newProbability) : undefined,
          expectedCloseDate: newCloseDate ? new Date(newCloseDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create deal");
      toast.success("Deal created successfully");
      setIsCreateOpen(false);
      setNewTitle("");
      setNewAmount("");
      setNewContactId("");
      fetchDeals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating deal");
    } finally {
      setCreating(false);
    }
  };

  const handleStageChange = async (targetStage: string) => {
    if (!selectedDeal) return;
    try {
      setUpdatingStage(true);
      const res = await fetch(`/api/crm/deals/${selectedDeal.dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: targetStage,
          lostReason: targetStage === "lost" ? lostReasonInput : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to update deal stage");
      toast.success(`Deal moved to ${targetStage}`);
      setSelectedDeal(null);
      setLostReasonInput("");
      fetchDeals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  const totalValue = deals.reduce((sum, d) => sum + (d.amount || 0), 0);
  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = deals.filter((d) => d.stage === "won");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-7xl mx-auto p-4 md:p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" />
            Deals & Sales Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your sales opportunities, revenue forecast, and deals pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-border/60 rounded-lg p-0.5 bg-muted/30">
            <Button
              variant={viewMode === "kanban" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 gap-1.5 text-xs font-semibold"
              onClick={() => setViewMode("kanban")}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </Button>
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-2.5 gap-1.5 text-xs font-semibold"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table
            </Button>
          </div>

          <Button
            size="sm"
            className="gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white border-none shadow-xs"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Create Deal
          </Button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Total Pipeline Value</span>
          <p className="text-xl font-bold text-foreground mt-1">৳{totalValue.toLocaleString("en-BD")}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Active Open Deals</span>
          <p className="text-xl font-bold text-foreground mt-1">{openDeals.length}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Won Deals</span>
          <p className="text-xl font-bold text-emerald-500 mt-1">{wonDeals.length}</p>
        </Card>
        <Card className="border-border/60 bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">Win Rate</span>
          <p className="text-xl font-bold text-foreground mt-1">
            {deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0}%
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-xl border border-border/60">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={stageFilter} onValueChange={(val) => setStageFilter(val || "all")}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD VIEW */
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {STAGES.map((col) => {
            const colDeals = deals.filter((d) => d.stage === col.id);
            const colValue = colDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

            return (
              <div
                key={col.id}
                className="w-72 shrink-0 flex flex-col rounded-xl border border-border/60 bg-muted/20 min-h-[500px]"
              >
                {/* Column Header */}
                <div className={`p-3 border-b border-border/50 flex items-center justify-between rounded-t-xl ${col.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{col.name}</span>
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {colDeals.length}
                    </Badge>
                  </div>
                  <span className="text-xs font-semibold">
                    ৳{colValue.toLocaleString("en-BD")}
                  </span>
                </div>

                {/* Cards List */}
                <div className="p-2 space-y-2.5 flex-1 overflow-y-auto max-h-[650px]">
                  {colDeals.map((deal) => (
                    <motion.div
                      key={deal.dealId}
                      layout
                      onClick={() => setSelectedDeal(deal)}
                      whileHover={{ scale: 1.01 }}
                      className="p-3.5 rounded-lg border border-border/60 bg-card hover:border-primary/40 shadow-2xs cursor-pointer transition-colors space-y-2"
                    >
                      <h4 className="font-semibold text-sm text-foreground line-clamp-1">{deal.title}</h4>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-primary">
                          {deal.amount ? `৳${deal.amount.toLocaleString("en-BD")}` : "No amount"}
                        </span>
                        {deal.probability !== null && (
                          <span className="text-[11px] text-muted-foreground">{deal.probability}% win</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                        <span className="truncate max-w-[120px]">
                          {deal.contact?.name || "No contact"}
                        </span>
                        {deal.expectedCloseDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(deal.expectedCloseDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {colDeals.length === 0 && (
                    <div className="h-32 flex items-center justify-center text-xs text-muted-foreground/60 border border-dashed border-border/40 rounded-lg">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <Card className="border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal Title</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Probability</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow
                  key={deal.dealId}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelectedDeal(deal)}
                >
                  <TableCell className="font-semibold">{deal.title}</TableCell>
                  <TableCell>{deal.contact?.name || "Unnamed"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {deal.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold">
                    {deal.amount ? `৳${deal.amount.toLocaleString("en-BD")}` : "—"}
                  </TableCell>
                  <TableCell>{deal.probability ? `${deal.probability}%` : "—"}</TableCell>
                  <TableCell>
                    {deal.expectedCloseDate
                      ? new Date(deal.expectedCloseDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDeal(deal);
                    }}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {deals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No deals found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Selected Deal Detail Sheet */}
      <Sheet open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <SheetContent className="sm:max-w-md space-y-6">
          {selectedDeal && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize text-xs font-semibold">
                    {selectedDeal.stage}
                  </Badge>
                  {selectedDeal.amount && (
                    <span className="text-sm font-bold text-primary">
                      ৳{selectedDeal.amount.toLocaleString("en-BD")}
                    </span>
                  )}
                </div>
                <SheetTitle className="text-xl font-bold">{selectedDeal.title}</SheetTitle>
                <SheetDescription>
                  Created on {new Date(selectedDeal.createdAt).toLocaleDateString()}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-sm">
                <div className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">Associated Contact</span>
                  <p className="font-semibold text-foreground">{selectedDeal.contact?.name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{selectedDeal.contact?.phone || "No phone"}</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs text-primary"
                    onClick={() => router.push(`/dashboard/contacts/${selectedDeal.contactId}`)}
                  >
                    View Contact 360 Profile →
                  </Button>
                </div>

                {/* Move Pipeline Stage Controls */}
                <div className="space-y-2 border-t border-border/50 pt-4">
                  <Label className="font-semibold text-sm">Move Pipeline Stage</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {STAGES.map((stg) => (
                      <Button
                        key={stg.id}
                        variant={selectedDeal.stage === stg.id ? "default" : "outline"}
                        size="sm"
                        disabled={updatingStage || selectedDeal.stage === stg.id}
                        onClick={() => handleStageChange(stg.id)}
                        className="text-xs justify-start gap-1.5 capitalize"
                      >
                        {stg.id === "won" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                        {stg.id === "lost" && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                        {stg.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedDeal.stage === "lost" && selectedDeal.lostReason && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600">
                    <span className="font-semibold">Lost Reason: </span>
                    {selectedDeal.lostReason}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Deal Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sales Deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateDeal} className="space-y-4">
            <div className="space-y-2">
              <Label>Deal Title *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Enterprise CRM Package"
                required
              />
            </div>

            {/* Contact Selector */}
            <div className="space-y-2">
              <Label>Select Contact *</Label>
              <Input
                placeholder="Search contact name or phone..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
              {contactOptions.length > 0 && (
                <div className="max-h-36 overflow-y-auto border border-border/60 rounded-md p-1 bg-card space-y-1">
                  {contactOptions.map((c) => (
                    <div
                      key={c.contactId}
                      className={`p-2 rounded text-xs cursor-pointer flex justify-between ${
                        newContactId === c.contactId ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setNewContactId(c.contactId);
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Value (BDT)</Label>
                <Input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="৳15,000"
                />
              </div>
              <div className="space-y-2">
                <Label>Stage</Label>
                <Select value={newStage} onValueChange={(val) => setNewStage(val || "new")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Win Probability (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={newProbability}
                  onChange={(e) => setNewProbability(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Close Date</Label>
                <Input
                  type="date"
                  value={newCloseDate}
                  onChange={(e) => setNewCloseDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Deal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
