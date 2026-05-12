"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AffiliateBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative p-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <Sparkles className="w-32 h-32 text-primary" />
      </div>
      
      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
          Coming Soon
        </div>
        <h3 className="text-2xl font-bold mb-3">Earn Cash with the Driplare Affiliate Program</h3>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Soon you will be able to earn real commission for every paying customer you bring to Driplare AI. 
          Stay tuned for our professional affiliate dashboard and higher reward tiers.
        </p>
        <Button variant="outline" className="rounded-xl gap-2 border-primary/20 hover:bg-primary/5">
          Get Notified <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
