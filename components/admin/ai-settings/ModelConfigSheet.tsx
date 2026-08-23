"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, Cpu, DollarSign, Save, Sliders, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface OpenRouterModelConfig {
  id: string;
  name: string;
  provider: string;
  tier: "Economy" | "Standard" | "Premium";
  promptPrice: number;
  completionPrice: number;
  credits: number;
  isMerchantActive: boolean;
  isManualOverride?: boolean;
  isDeprecated?: boolean;
  contextWindow: number;
  maxTokens: number;
  temperature: number;
}

interface ModelConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: OpenRouterModelConfig | null;
  onSave: (updatedModel: OpenRouterModelConfig) => void;
}

export function ModelConfigSheet({
  open,
  onOpenChange,
  model,
  onSave,
}: ModelConfigSheetProps) {
  const { t } = useTranslation("admin");
  const [formData, setFormData] = useState<OpenRouterModelConfig | null>(model);

  useEffect(() => {
    setFormData(model);
  }, [model]);

  if (!formData) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSave(formData);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col justify-between">
        <div>
          <SheetHeader className="space-y-2 pb-4 border-b border-border/40">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">{formData.name}</SheetTitle>
                <SheetDescription className="text-xs font-mono text-muted-foreground">
                  {formData.provider} • {formData.id}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form id="model-config-form" onSubmit={handleSubmit} className="py-6 space-y-6">
            {/* ── OpenRouter Token Pricing ── */}
            <div className="rounded-xl border border-primary/10 bg-muted/20 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary" />
                OpenRouter Live Token Cost (per 1M)
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-card p-2.5 rounded-lg border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Prompt (Input):</span>
                  <span className="font-mono font-bold text-foreground">${formData.promptPrice.toFixed(2)} / 1M</span>
                </div>
                <div className="bg-card p-2.5 rounded-lg border border-border/60">
                  <span className="text-[10px] text-muted-foreground block">Completion (Output):</span>
                  <span className="font-mono font-bold text-foreground">${formData.completionPrice.toFixed(2)} / 1M</span>
                </div>
              </div>
            </div>

            {/* ── Merchant Active Toggle ── */}
            <div className="flex items-center justify-between gap-2 p-4 rounded-xl border border-primary/10 bg-card">
              <div>
                <Label className="text-xs font-medium cursor-pointer">Merchant Active (Pro Merchants)</Label>
                <p className="text-[10px] text-muted-foreground">Enable to allow Pro merchants to pick this model in bot settings</p>
              </div>
              <Switch
                checked={formData.isMerchantActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isMerchantActive: checked })}
              />
            </div>

            {/* ── Credit Override & Parameters ── */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                Credit Cost & Parameters
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit Cost per reply</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.credits}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        credits: parseInt(e.target.value) || 1,
                        isManualOverride: true,
                      })
                    }
                    className="h-9 text-xs rounded-xl border-primary/20 font-mono font-bold text-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Assigned Tier</Label>
                  <Select
                    value={formData.tier}
                    onValueChange={(val: "Economy" | "Standard" | "Premium") =>
                      setFormData({ ...formData, tier: val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl border-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Economy">Economy (1 Cr)</SelectItem>
                      <SelectItem value="Standard">Standard (3 Cr)</SelectItem>
                      <SelectItem value="Premium">Premium (5 Cr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Output Tokens</Label>
                  <Input
                    type="number"
                    step="256"
                    min="256"
                    value={formData.maxTokens}
                    onChange={(e) =>
                      setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 4096 })
                    }
                    className="h-9 text-xs rounded-xl border-primary/20 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Context Window</Label>
                  <Input
                    type="number"
                    step="1000"
                    min="4000"
                    value={formData.contextWindow}
                    onChange={(e) =>
                      setFormData({ ...formData, contextWindow: parseInt(e.target.value) || 128000 })
                    }
                    className="h-9 text-xs rounded-xl border-primary/20 font-mono"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <SheetFooter className="pt-4 border-t border-border/40 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl text-xs">
            Cancel
          </Button>
          <Button
            type="submit"
            form="model-config-form"
            size="sm"
            className="rounded-xl text-xs gap-1.5 bg-brand-gradient text-primary-foreground hover:opacity-90"
          >
            <Save className="h-3.5 w-3.5" />
            Apply Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
