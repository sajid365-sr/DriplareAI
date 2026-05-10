"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { EyeOff, History, Info, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const RETENTION_OPTIONS = [
  { value: "30", label: "30 Days", desc: "Logs are automatically deleted after a month." },
  { value: "90", label: "90 Days", desc: "Keep history for a full quarter." },
  { value: "365", label: "1 Year", desc: "Logs are kept for a year before removal." },
  { value: "forever", label: "Indefinite", desc: "No logs are ever automatically deleted." },
];

export function DataRetentionCard() {
  const [retention, setRetention] = useState("forever");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/usage")
      .then(r => r.json())
      .then(data => {
        if (data.dataRetention) {
          setRetention(data.dataRetention);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        body: JSON.stringify({ dataRetention: retention }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Retention settings updated successfully!");
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="p-6 rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <History className="w-6 h-6 text-primary" />
        <h3 className="font-bold text-xl">Data Retention</h3>
      </div>
      <p className="text-base text-muted-foreground mb-6">
        Choose how long you want to store your chatbot conversation logs and visitor data.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {RETENTION_OPTIONS.map((opt) => (
            <label 
              key={opt.value}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                retention === opt.value 
                  ? "bg-primary/5 border-primary ring-1 ring-primary/20" 
                  : "bg-muted/30 border-border hover:bg-muted/50"
              }`}
            >
              <input 
                type="radio" 
                name="retention" 
                value={opt.value} 
                checked={retention === opt.value}
                onChange={(e) => setRetention(e.target.value)}
                className="w-5 h-5 text-primary focus:ring-primary border-border"
              />
              <div className="flex-1">
                <p className="text-base font-semibold">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
              </div>
              {opt.value === "30" && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-bold uppercase tracking-wider">
                  <EyeOff className="w-3.5 h-3.5" />
                  Private
                </div>
              )}
            </label>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-5">
        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
          <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Changing this setting will apply to all existing and future logs. Deleted logs cannot be recovered.
          </p>
        </div>
        
        <Button 
          size="lg"
          className="w-full rounded-xl gap-2 font-semibold" 
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? "Saving Changes..." : <><Save className="w-5 h-5" /> Save Retention Policy</>}
        </Button>
      </div>
    </motion.div>
  );
}
