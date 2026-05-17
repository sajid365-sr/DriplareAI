"use client";

import { Calendar, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/core/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function DateRangePicker({ 
  rangeType, 
  dateRange, 
  onRangeChange, 
  onDateRangeSelect, 
  isBn, 
  data 
}: any) {
  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-bold bg-card border-border shadow-sm hover:bg-muted/50 rounded-xl h-11 px-4",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
            {rangeType === "billing" ? (
              <span>
                {isBn ? "বিলিং সাইকেল" : "Billing Cycle"} ({new Date(data?.billingCycleStart).toLocaleDateString(isBn ? "bn-BD" : "en-US", { month: "short", day: "numeric" })})
              </span>
            ) : dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd, y")} -{" "}
                  {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>{isBn ? "ডেট রেঞ্জ সিলেক্ট করুন" : "Select Date Range"}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-border bg-card" align="end">
          <div className="flex flex-col sm:flex-row">
            <div className="p-2 border-b sm:border-b-0 sm:border-r border-border bg-muted/20 flex flex-col gap-1 min-w-[160px]">
              {[
                { id: "billing", label: isBn ? "বিলিং সাইকেল" : "Billing Cycle" },
                { id: "24h", label: isBn ? "গত ২৪ ঘণ্টা" : "Last 24 Hours" },
                { id: "7d", label: isBn ? "গত ৭ দিন" : "Last 7 Days" },
                { id: "30d", label: isBn ? "গত ৩০ দিন" : "Last 30 Days" },
                { id: "all", label: isBn ? "সব সময়" : "All Time" },
                { id: "custom", label: isBn ? "কাস্টম রেঞ্জ" : "Custom Range" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onRangeChange(opt.id)}
                  className={cn(
                    "text-left px-3 py-2 rounded-lg text-xs font-bold transition-all",
                    rangeType === opt.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {rangeType === "custom" && (
              <div className="p-1">
                <CalendarUI
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={onDateRangeSelect}
                  numberOfMonths={1}
                  className="rounded-xl border-none"
                />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
