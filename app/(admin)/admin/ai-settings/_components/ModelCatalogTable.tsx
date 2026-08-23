"use client";

import { MoreHorizontal, Sliders, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type OpenRouterModelConfig } from "@/components/admin/ai-settings/ModelConfigSheet";
import { formatPriceWithBDT, type AISettingsData } from "./types";

interface ModelCatalogTableProps {
  paginatedModels: OpenRouterModelConfig[];
  settings: AISettingsData;
  onUpdateCreditCost: (modelId: string, credits: number) => void;
  onToggleMerchantActive: (modelId: string, active: boolean) => void;
  onConfigureModel: (model: OpenRouterModelConfig) => void;
  onDeleteModel: (model: OpenRouterModelConfig) => void;
}

export function ModelCatalogTable({
  paginatedModels,
  settings,
  onUpdateCreditCost,
  onToggleMerchantActive,
  onConfigureModel,
  onDeleteModel,
}: ModelCatalogTableProps) {
  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left text-xs sm:text-sm min-w-[850px]">
          <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold whitespace-nowrap">
            <tr>
              <th className="p-4 font-bold min-w-[200px]">Model Name & ID</th>
              <th className="p-4 font-bold min-w-[120px]">Provider</th>
              <th className="p-4 font-bold min-w-[230px]">Token Pricing (Prompt / Completion per 1M)</th>
              <th className="p-4 font-bold min-w-[100px]">Credit Cost</th>
              <th className="p-4 font-bold min-w-[170px]">Preset & Status</th>
              <th className="p-4 font-bold text-center min-w-[120px]">Merchant Active</th>
              <th className="p-4 font-bold text-right min-w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedModels.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground text-sm">
                  No models match your search or multi-criteria filter selections.
                </td>
              </tr>
            ) : (
              paginatedModels.map((m) => {
                const isFast = settings.quickSetup.fastModel === m.id;
                const isSmart = settings.quickSetup.smartModel === m.id;
                const isGenius = settings.quickSetup.geniusModel === m.id;

                return (
                  <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium min-w-[200px]">
                      <div className="font-bold text-foreground text-sm sm:text-base">{m.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{m.id}</div>
                    </td>
                    <td className="p-4 text-muted-foreground font-medium text-xs sm:text-sm min-w-[120px]">
                      {m.provider}
                    </td>
                    <td className="p-4 font-mono text-xs whitespace-nowrap min-w-[230px]">
                      <div className="text-foreground font-semibold text-xs sm:text-sm">
                        {formatPriceWithBDT(m.promptPrice)} / {formatPriceWithBDT(m.completionPrice)}
                      </div>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">per 1M tokens</span>
                    </td>
                    <td className="p-4 font-mono font-bold min-w-[100px]">
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={m.credits}
                        onChange={(e) =>
                          onUpdateCreditCost(m.id, parseInt(e.target.value) || 1)
                        }
                        className="h-8 w-18 text-center font-bold text-xs sm:text-sm rounded-xl border-primary/20 bg-background text-primary"
                      />
                    </td>
                    <td className="p-4 min-w-[170px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.isDeprecated && (
                          <Badge variant="destructive" className="text-xs bg-destructive/15 text-destructive border-destructive/30 font-semibold">
                            🔴 Deprecated
                          </Badge>
                        )}
                        {isFast && (
                          <Badge variant="outline" className="text-xs border-success/30 bg-success/10 text-success font-semibold">
                            Fast Preset (1 Cr)
                          </Badge>
                        )}
                        {isSmart && (
                          <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary font-semibold">
                            Smart Preset (3 Cr)
                          </Badge>
                        )}
                        {isGenius && (
                          <Badge variant="outline" className="text-xs border-warning/30 bg-warning/10 text-warning font-semibold">
                            Genius Preset (5 Cr)
                          </Badge>
                        )}
                        {!isFast && !isSmart && !isGenius && !m.isDeprecated && (
                          <span className="text-xs text-muted-foreground font-mono">Custom Pro</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center min-w-[120px]">
                      {m.isDeprecated ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span className="inline-block cursor-not-allowed">
                                  <Switch
                                    checked={false}
                                    disabled={true}
                                  />
                                </span>
                              }
                            />
                            <TooltipContent className="max-w-xs text-xs font-medium">
                              This model is deprecated by OpenRouter and cannot be activated for merchants.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Switch
                          checked={m.isMerchantActive}
                          onCheckedChange={(checked) => onToggleMerchantActive(m.id, checked)}
                        />
                      )}
                    </td>
                    <td className="p-4 text-right min-w-[80px]">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none cursor-pointer border border-transparent hover:border-border/60">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-36">
                          <DropdownMenuItem
                            onClick={() => onConfigureModel(m)}
                            className="cursor-pointer gap-2 text-xs font-medium"
                          >
                            <Sliders className="h-3.5 w-3.5 text-primary" />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteModel(m)}
                            className="cursor-pointer gap-2 text-xs font-medium text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
}
