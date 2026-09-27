"use client";

import { Suspense } from "react";
import { RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import { useInboxState } from "./_components/useInboxState";
import { InboxLayout } from "./_components/InboxLayout";

/**
 * Inner content component that uses `useSearchParams()` and therefore
 * must be wrapped in a `<Suspense>` boundary.
 */
function GlobalLiveInboxContent() {
  const state = useInboxState();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      <InboxLayout state={state} />
    </motion.div>
  );
}

/**
 * Global Live Inbox page — displays all chatbot sessions in a
 * 3-column responsive layout (Session List | Conversation | CRM).
 */
export default function GlobalLiveInboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full w-full p-8 text-muted-foreground text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-primary" />
          Loading Live Inbox...
        </div>
      }
    >
      <GlobalLiveInboxContent />
    </Suspense>
  );
}
