"use client";

import { motion } from "framer-motion";
import { Zap, MessageSquare, Plus, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AutomationsPage() {
  const RULES = [
    { title: "Comment-to-DM Auto Reply", trigger: "User comments on FB Post", action: "Send DM with price link", active: true },
    { title: "Keyword Order Trigger", trigger: "Customer sends 'Order' or 'দাম'", action: "Send product catalog & order form", active: true },
    { title: "Out of Office Auto Response", trigger: "Message received after 10 PM", action: "Send automated greeting", active: false },
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
            <Zap className="w-6 h-6 text-primary" />
            Automations & Keyword Triggers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automate social engagements, Comment-to-DM triggers, and custom workflow rules.
          </p>
        </div>

        <Button className="gap-2 bg-brand-gradient hover:opacity-90 text-white border-none">
          <Plus className="w-4 h-4" />
          Create Automation Rule
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {RULES.map((rule, idx) => (
          <div key={idx} className="bg-card border border-border/60 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-foreground">{rule.title}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${rule.active ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground"}`}>
                {rule.active ? "Active" : "Disabled"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border/40">
              <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{rule.trigger}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">{rule.action}</span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
