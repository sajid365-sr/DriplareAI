import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, Download, FileText, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow, addHours, isAfter } from "date-fns";

export function DataExportCard() {
  const [requesting, setRequesting] = useState(false);
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const COOLDOWN_HOURS = 72;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/user/settings");
        const data = await res.json();
        if (data.lastDataExportAt) {
          setLastExportAt(data.lastDataExportAt);
        }
      } catch (error) {
        console.error("Failed to fetch settings", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const getCooldownStatus = () => {
    if (!lastExportAt) return { isActive: false };
    
    const nextAvailable = addHours(new Date(lastExportAt), COOLDOWN_HOURS);
    const isActive = isAfter(nextAvailable, new Date());
    
    return {
      isActive,
      remaining: isActive ? formatDistanceToNow(nextAvailable) : null
    };
  };

  const cooldown = getCooldownStatus();

  const handleExport = async () => {
    setRequesting(true);
    try {
      const res = await fetch("/api/user/export", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Export failed");
        return;
      }
      
      setLastExportAt(new Date().toISOString());
      toast.success("Data export request received. Check your email!");
    } catch (error) {
      toast.error("Failed to process export request");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="p-6 rounded-2xl border border-border bg-card shadow-sm h-full"
    >
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-6 h-6 text-primary" />
        <h3 className="font-bold text-xl">Data Portability</h3>
      </div>
      <p className="text-base text-muted-foreground mb-6">
        Export a comprehensive report of your personal data, chatbot configurations, and account logs.
      </p>

      <div className="space-y-5">
        {/* Permanent Rate Limit Notice */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-center">
          <AlertCircle className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm font-medium text-foreground">
            Notice: Data exports can be requested once every <span className="text-primary font-bold">72 hours</span> for security and resource management.
          </p>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
          <div className="w-12 h-12 rounded-lg bg-background flex items-center justify-center border border-border shrink-0">
            <FileText className="w-6 h-6 text-rose-500" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">Complete Report (PDF & JSON)</p>
            <p className="text-sm text-muted-foreground mt-0.5">Professional summary and raw data sent via email.</p>
          </div>
          
          <Button 
            variant={cooldown.isActive ? "secondary" : "outline"} 
            size="default" 
            className="rounded-lg gap-1.5 px-5"
            onClick={handleExport}
            disabled={requesting || cooldown.isActive || loading}
          >
            {requesting ? "Processing..." : cooldown.isActive ? "Locked" : <><Download className="w-4 h-4" /> Request</>}
          </Button>
        </div>

        {cooldown.isActive && (
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3 items-start">
            <Clock className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-amber-600">Rate Limit Active</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You have already requested an export recently. 
                You can request your next data export in <strong className="text-amber-700">{cooldown.remaining}</strong>.
              </p>
            </div>
          </div>
        )}

        {!cooldown.isActive && !loading && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border flex gap-3 items-start">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Delivery Information</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your data will be compiled into a secure PDF and JSON file and sent directly to your registered email address within minutes.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
