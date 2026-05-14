"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";

interface IntegrationHeaderProps {
  activeCount: number;
  usage: any;
}

export const IntegrationHeader = ({ activeCount, usage }: IntegrationHeaderProps) => {
  const max = usage?.maxIntegrationsPerChatbot || 1;
  const percentage = Math.min((activeCount / max) * 100, 100);
  const isInfinite = usage?.maxIntegrationsPerChatbot === Infinity;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
        >
          Integrations
        </motion.h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your chatbot to multiple channels and platforms.
        </p>
      </div>

      {usage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative group p-4 px-6 rounded-2xl border border-border bg-card/50 backdrop-blur-md shadow-xl overflow-hidden min-w-[240px]"
        >
          {/* Animated Background Pulse */}
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Usage Limit</span>
              </div>
              <span className="text-sm font-black text-foreground">
                {activeCount} <span className="text-muted-foreground/50 font-medium">/</span> {isInfinite ? "∞" : max}
              </span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border/50">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  percentage > 90 ? "bg-rose-500" : percentage > 70 ? "bg-amber-500" : "bg-gradient-to-r from-violet-500 to-blue-500"
                }`}
              />
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground font-medium">
                {isInfinite ? "Unlimited integrations" : `${max - activeCount} spots remaining`}
              </span>
              {percentage >= 100 && !isInfinite && (
                <span className="text-[10px] text-rose-500 font-bold animate-pulse">Limit Reached</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
