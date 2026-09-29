"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { type OpenRouterModelConfig } from "@/components/admin/ai-settings/ModelConfigSheet";
import { formatPriceWithBDT } from "./types";
import { cn } from "@/lib/utils";

interface ModelComboboxProps {
  models: OpenRouterModelConfig[];
  value: string;
  onSelect: (value: string) => void;
  /** Live USD → BDT rate, so the ৳ preview here matches the table and the reports. */
  usdToBdtRate: number;
  /** Falls back to the translated default when the caller passes nothing. */
  placeholder?: string;
}

export function ModelCombobox({
  models,
  value,
  onSelect,
  usdToBdtRate,
  placeholder,
}: ModelComboboxProps) {
  const { t } = useTranslation("admin");
  const [open, setOpen] = useState(false);
  const selectedModel = models.find((m) => m.id === value);
  const placeholderText = placeholder ?? t("aiSettings.combobox.placeholder");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-9 justify-between rounded-xl border-primary/20 bg-card text-xs font-normal hover:bg-muted/40"
        >
          {selectedModel ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-medium text-foreground truncate">
                {selectedModel.name}
              </span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 font-mono">
                {selectedModel.provider}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholderText}</span>
          )}
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 rounded-xl shadow-lg border-primary/10" align="start">
        <Command>
          <CommandInput
            placeholder={t("aiSettings.combobox.searchPlaceholder")}
            className="text-xs"
          />
          <CommandList className="max-h-60 no-scrollbar overflow-y-auto">
            <CommandEmpty className="py-4 text-xs text-center text-muted-foreground">
              {t("aiSettings.combobox.empty")}
            </CommandEmpty>
            <CommandGroup>
              {models.map((m) => {
                const isSelected = m.id === value;
                return (
                  <CommandItem
                    key={m.id}
                    value={`${m.name} ${m.provider} ${m.id}`}
                    onSelect={() => {
                      onSelect(m.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between text-xs py-2 px-3 rounded-lg cursor-pointer data-[selected=true]:bg-primary/10"
                  >
                    <div className="flex flex-col gap-0.5 truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-medium text-foreground truncate">{m.name}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                          {m.provider}
                        </Badge>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {formatPriceWithBDT(m.promptPrice, usdToBdtRate)} /{" "}
                        {formatPriceWithBDT(m.completionPrice, usdToBdtRate)}{" "}
                        {t("aiSettings.combobox.perMillionShort")}
                      </span>
                    </div>
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 text-primary ml-2 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
