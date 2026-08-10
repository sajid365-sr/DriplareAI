"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, CheckSquare, Truck, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FloatingBulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDispatch: (courierProvider: string) => Promise<void>;
  onDeleteSelected: () => void;
  dispatching: boolean;
  deleting?: boolean;
}

export function FloatingBulkActionBar({
  selectedCount,
  onClearSelection,
  onDispatch,
  onDeleteSelected,
  dispatching,
  deleting = false,
}: FloatingBulkActionBarProps) {
  const [courierProvider, setCourierProvider] = useState("Steadfast");

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 sm:gap-4 bg-gray-900/95 dark:bg-card/95 border border-border/80 shadow-2xl rounded-2xl px-4 sm:px-5 py-3 text-white backdrop-blur-md"
      >
        {/* Count Badge */}
        <div className="flex items-center gap-2.5 pr-3 border-r border-gray-700 dark:border-border/60">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/20 text-primary font-bold text-xs">
            <CheckSquare className="w-4 h-4 text-primary" />
          </span>
          <div>
            <p className="text-xs font-bold text-white dark:text-foreground whitespace-nowrap">
              {selectedCount} {selectedCount === 1 ? "Order" : "Orders"} Selected
            </p>
            <p className="text-[10px] text-gray-400 dark:text-muted-foreground hidden sm:block">
              Perform action on selected
            </p>
          </div>
        </div>

        {/* Courier Select */}
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-muted-foreground hidden md:block" />
          <select
            value={courierProvider}
            onChange={(e) => setCourierProvider(e.target.value)}
            disabled={dispatching || deleting}
            className="h-9 px-3 rounded-xl bg-gray-800 dark:bg-muted text-xs font-medium border border-gray-700 dark:border-border/60 text-white dark:text-foreground outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            <option value="Steadfast">Steadfast Express 🚚</option>
            <option value="Pathao">Pathao Courier 🏍️</option>
            <option value="RedX">RedX Logistics 📦</option>
          </select>
        </div>

        {/* Send to Courier Action Button */}
        <Button
          onClick={() => onDispatch(courierProvider)}
          disabled={dispatching || deleting}
          className="h-9 px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-xs font-bold shadow-md gap-1.5"
        >
          {dispatching ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Dispatching...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>Send to Courier</span>
            </>
          )}
        </Button>

        {/* Bulk Delete Button */}
        <Button
          variant="destructive"
          onClick={onDeleteSelected}
          disabled={dispatching || deleting}
          className="h-9 px-3.5 sm:px-4 rounded-xl text-xs font-bold shadow-md gap-1.5"
        >
          {deleting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </>
          )}
        </Button>

        {/* Clear Selection */}
        <button
          onClick={onClearSelection}
          disabled={dispatching || deleting}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white dark:hover:text-foreground hover:bg-gray-800 dark:hover:bg-muted transition-colors"
          title="Clear Selection"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
