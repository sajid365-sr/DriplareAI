"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PlatformCardProps {
  platform: any;
  icon: any;
  onToggle: (platform: any) => void;
}

export const PlatformCard = ({ platform, icon: Icon, onToggle }: PlatformCardProps) => {
  if (platform.coming_soon) {
    return (
      <div className="relative p-6 rounded-2xl border border-border bg-muted/20 opacity-70 grayscale-[0.5] overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="p-3 rounded-2xl bg-muted/50 border border-border text-muted-foreground">
            <Icon className="w-6 h-6" />
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold bg-background/50">Soon</Badge>
        </div>
        <h3 className="text-lg font-bold text-muted-foreground">{platform.name}</h3>
        <p className="text-sm text-muted-foreground/70 mt-2 line-clamp-2">
          {platform.description}
        </p>
        <div className="mt-6 pt-6 border-t border-border/50">
          <Button disabled variant="outline" size="sm" className="rounded-xl px-5 opacity-50 cursor-not-allowed">
            Coming Soon
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }} 
      className="group relative p-6 rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden" 
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div 
            className="p-3 rounded-2xl bg-muted/50 border border-border group-hover:bg-background transition-colors shadow-sm" 
            style={{ color: platform.color }}
          >
            <Icon className="w-6 h-6" />
          </div>
          {platform.connected ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[11px] font-semibold animate-in fade-in zoom-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </div>
          ) : null}
        </div>

        <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{platform.name}</h3>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 min-h-[40px] leading-relaxed">
          {platform.description}
        </p>

        <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
          <Button 
            variant={platform.connected ? "outline" : "default"}
            size="sm"
            onClick={() => onToggle(platform)}
            className={`rounded-xl px-5 font-semibold shadow-sm transition-all ${!platform.connected && "bg-primary hover:bg-primary/90 shadow-primary/20"}`}
          >
            {platform.connected ? "Disconnect" : "Connect"}
          </Button>
          
          {!platform.connected && <ChevronRight className="w-4 h-4 ml-1 opacity-70" />}
          
          {platform.connected && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={() => onToggle(platform)}
            >
              <Plug className="w-4 h-4 rotate-45" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
