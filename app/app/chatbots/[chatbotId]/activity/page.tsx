"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";

export default function Activity() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [msgs, setMsgs] = useState<any[]>([]);

  useEffect(() => { 
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}/messages`)
      .then(r => r.json())
      .then(data => setMsgs(Array.isArray(data) ? data : [])); 
  }, [chatbotId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border max-h-[70vh] overflow-y-auto scrollbar-thin">
        {msgs.length === 0 && <div className="p-10 text-center text-muted-foreground">No activity yet</div>}
        {msgs.map((m, i) => (
          <motion.div key={m.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="px-5 py-3 flex items-start gap-3" data-testid={`activity-${i}`}>
            <span className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded-md ${m.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"}`}>{m.role}</span>
            <div className="flex-1 text-sm">{m.content}</div>
            <span className="text-xs text-muted-foreground shrink-0">{new Date(m.timestamp).toLocaleTimeString()}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
