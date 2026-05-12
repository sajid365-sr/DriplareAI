"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

const CONFIRM_PHRASE = "Delete my account";

export function DangerZone() {
  const { user } = useUser();
  const router = useRouter();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const name = user?.fullName || "User";
  const email = user?.primaryEmailAddress?.emailAddress || "";

  const handleDeleteAccount = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Account deleted successfully.");
      router.push("/");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
        className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h3 className="font-bold text-destructive">Danger Zone</h3>
          <span className="ml-auto text-xs text-destructive/70">Irreversible actions</span>
        </div>
        <div className="mt-4 pt-4 border-t border-destructive/10 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Delete Account</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Permanently delete your account, chatbots, training data, and all records. This cannot be undone.
            </p>
          </div>
          <Button variant="destructive" size="sm" className="rounded-xl shrink-0"
            onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
          </Button>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteDialog(false); setConfirmText(""); } }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="font-semibold text-sm">Delete Account</h2>
                <button onClick={() => { setShowDeleteDialog(false); setConfirmText(""); }}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="flex flex-col items-center text-center gap-3 pb-4 border-b border-border">
                  <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                    <ShieldAlert className="w-7 h-7 text-destructive" />
                  </div>
                  <div>
                    <p className="font-bold text-base">{name}</p>
                    <p className="text-xs text-muted-foreground">{email}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-destructive">This will permanently delete:</p>
                  <ul className="space-y-1 text-muted-foreground text-xs">
                    {[
                      "All your AI chatbots and their configurations",
                      "All chat history and conversation logs",
                      "All knowledge base sources and training data",
                      "All integrations (WhatsApp, Facebook, Web Widget)",
                      "All billing records and payment history",
                      "Your account from all systems (including Clerk)",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-destructive mt-0.5">✕</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    To confirm, type{" "}
                    <span className="font-mono font-bold text-foreground">"{CONFIRM_PHRASE}"</span>{" "}
                    in the box below
                  </label>
                  <Input
                    placeholder={CONFIRM_PHRASE}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className={`font-mono text-sm rounded-xl transition-colors ${
                      confirmText === CONFIRM_PHRASE
                        ? "border-destructive ring-1 ring-destructive"
                        : ""
                    }`}
                    disabled={deleting}
                  />
                </div>

                <Button
                  variant="destructive"
                  className="w-full rounded-xl"
                  disabled={confirmText !== CONFIRM_PHRASE || deleting}
                  onClick={handleDeleteAccount}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleting ? "Deleting your account..." : "Delete this account"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
