"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Eye, Sparkles, Zap, Timer, Check, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export interface HumanDelayConfig {
  enabled: boolean;
  seenDelayMs: number;
  typingSpeedCps: number;
  minTypingMs: number;
  maxTypingMs: number;
}

const DEFAULT_CONFIG: HumanDelayConfig = {
  enabled: true,
  seenDelayMs: 1200,
  typingSpeedCps: 25,
  minTypingMs: 1500,
  maxTypingMs: 8000,
};

interface HumanDelaySettingsProps {
  chatbotId: string;
  initialConfig?: HumanDelayConfig | null;
  onSaved?: (updatedConfig: HumanDelayConfig) => void;
}

export function HumanDelaySettings({
  chatbotId,
  initialConfig,
  onSaved,
}: HumanDelaySettingsProps) {
  const { t } = useTranslation("chatbots");
  const [config, setConfig] = useState<HumanDelayConfig>({
    ...DEFAULT_CONFIG,
    ...(initialConfig || {}),
  });
  const [saving, setSaving] = useState(false);

  const handleToggle = (checked: boolean) => {
    setConfig((prev) => ({ ...prev, enabled: checked }));
  };

  const handleChange = (key: keyof HumanDelayConfig, value: number) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/chatbots/${chatbotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanDelayConfig: config }),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success(t("humanDelay.saveSuccess"));
      if (onSaved) onSaved(config);
    } catch {
      toast.error(t("humanDelay.saveError"));
    } finally {
      setSaving(false);
    }
  };

  // Preview calculations for an average 100-character reply
  const previewSeenSec = (config.seenDelayMs / 1000).toFixed(1);
  const calculatedTypingMs = Math.min(
    Math.max((100 / (config.typingSpeedCps || 25)) * 1000, config.minTypingMs),
    config.maxTypingMs
  );
  const previewTypingSec = (calculatedTypingMs / 1000).toFixed(1);

  return (
    <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">
              {t("humanDelay.title")}
            </h2>
          </div>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            {t("humanDelay.description")}
          </p>
        </div>

        {/* Enable Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="h-px bg-border/60 w-full" />

          {/* Config Sliders & Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Seen Receipt Delay */}
            <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  {t("humanDelay.seenDelay")}
                </Label>
                <span className="text-[12px] font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                  {config.seenDelayMs} {t("humanDelay.milliseconds")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("humanDelay.seenDelayDesc")}
              </p>
              <input
                type="range"
                min={300}
                max={5000}
                step={100}
                value={config.seenDelayMs}
                onChange={(e) => handleChange("seenDelayMs", Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/70">
                <span>0.3s</span>
                <span>2.5s</span>
                <span>5.0s</span>
              </div>
            </div>

            {/* Typing Speed (CPS) */}
            <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  {t("humanDelay.typingSpeed")}
                </Label>
                <span className="text-[12px] font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                  {config.typingSpeedCps} {t("humanDelay.cps")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("humanDelay.typingSpeedDesc")}
              </p>
              <input
                type="range"
                min={10}
                max={60}
                step={5}
                value={config.typingSpeedCps}
                onChange={(e) => handleChange("typingSpeedCps", Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/70">
                <span>10 (Slow)</span>
                <span>30 (Natural)</span>
                <span>60 (Fast)</span>
              </div>
            </div>

            {/* Minimum Typing Duration */}
            <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-emerald-500" />
                  {t("humanDelay.minTyping")}
                </Label>
                <span className="text-[12px] font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                  {(config.minTypingMs / 1000).toFixed(1)} {t("humanDelay.seconds")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("humanDelay.minTypingDesc")}
              </p>
              <input
                type="range"
                min={500}
                max={4000}
                step={250}
                value={config.minTypingMs}
                onChange={(e) => handleChange("minTypingMs", Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/70">
                <span>0.5s</span>
                <span>2.0s</span>
                <span>4.0s</span>
              </div>
            </div>

            {/* Maximum Typing Duration Cap */}
            <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-500" />
                  {t("humanDelay.maxTyping")}
                </Label>
                <span className="text-[12px] font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10">
                  {(config.maxTypingMs / 1000).toFixed(1)} {t("humanDelay.seconds")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t("humanDelay.maxTypingDesc")}
              </p>
              <input
                type="range"
                min={3000}
                max={15000}
                step={500}
                value={config.maxTypingMs}
                onChange={(e) => handleChange("maxTypingMs", Number(e.target.value))}
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/70">
                <span>3.0s</span>
                <span>8.0s</span>
                <span>15.0s</span>
              </div>
            </div>
          </div>

          {/* Interactive Flow Preview */}
          <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[12px] font-bold text-foreground">
                {t("humanDelay.previewTitle")}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-lg bg-background/80 border border-border/50">
                <p className="text-[10px] text-muted-foreground font-semibold">Step 1</p>
                <p className="text-[11.5px] font-bold text-foreground mt-0.5">
                  {t("humanDelay.step1")}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-background/80 border border-blue-500/30">
                <p className="text-[10px] text-blue-500 font-semibold">Step 2</p>
                <p className="text-[11.5px] font-bold text-foreground mt-0.5">
                  {t("humanDelay.step2", { seen: previewSeenSec })}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-background/80 border border-amber-500/30">
                <p className="text-[10px] text-amber-500 font-semibold">Step 3</p>
                <p className="text-[11.5px] font-bold text-foreground mt-0.5">
                  {t("humanDelay.step3", { typing: previewTypingSec })}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-background/80 border border-emerald-500/30">
                <p className="text-[10px] text-emerald-500 font-semibold">Step 4</p>
                <p className="text-[11.5px] font-bold text-foreground mt-0.5">
                  {t("humanDelay.step4")}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full px-6 font-semibold"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {t("bot_settings.save", "Save")}
        </Button>
      </div>
    </div>
  );
}
