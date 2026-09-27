"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type AISettingsData } from "./types";
import { ModelCombobox } from "./ModelCombobox";

interface QuickSetupPresetsProps {
  settings: AISettingsData;
  onUpdateQuickSetup: (key: "fastModel" | "smartModel" | "geniusModel", value: string) => void;
}

export function QuickSetupPresets({
  settings,
  onUpdateQuickSetup,
}: QuickSetupPresetsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="w-full rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Quick Setup Presets (Default Tier Mapping)</h3>
            <p className="text-xs text-muted-foreground">
              Default fallback models for standard/starter merchants using Fast (1 Cr), Smart (3 Cr), or Genius (5 Cr) presets.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {/* Fast Model (1 Credit) */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-success">Fast Model</span>
            <Badge variant="outline" className="text-xs border-success/30 bg-success/10 text-success font-semibold">Fixed 1 Credit</Badge>
          </div>
          <p className="text-xs text-muted-foreground">High-speed, low-cost responses</p>
          <ModelCombobox
            models={settings.models}
            value={settings.quickSetup.fastModel}
            onSelect={(val) => onUpdateQuickSetup("fastModel", val)}
            placeholder="Select Fast model..."
          />
        </div>

        {/* Smart Model (3 Credits) */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-primary">Smart Model</span>
            <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary font-semibold">Fixed 3 Credits</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Balanced intelligence & speed</p>
          <ModelCombobox
            models={settings.models}
            value={settings.quickSetup.smartModel}
            onSelect={(val) => onUpdateQuickSetup("smartModel", val)}
            placeholder="Select Smart model..."
          />
        </div>

        {/* Genius Model (5 Credits) */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-warning">Genius Model</span>
            <Badge variant="outline" className="text-xs border-warning/30 bg-warning/10 text-warning font-semibold">Fixed 5 Credits</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Top-tier reasoning & accuracy</p>
          <ModelCombobox
            models={settings.models}
            value={settings.quickSetup.geniusModel}
            onSelect={(val) => onUpdateQuickSetup("geniusModel", val)}
            placeholder="Select Genius model..."
          />
        </div>
      </div>
    </motion.div>
  );
}
