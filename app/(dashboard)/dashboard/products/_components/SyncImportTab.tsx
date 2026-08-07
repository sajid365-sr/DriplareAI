"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Upload, Sparkles, Check, Plus, Share2, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FBPostSyncSection } from "./FBPostSyncSection";
import { ProductImageUploader } from "./ProductImageUploader";
import { AddSingleProductDrawer } from "./AddSingleProductDrawer";
import { CSVBatchUploader } from "./CSVBatchUploader";

type SyncImportTabProps = {
  agentId: string;
  onProductsSaved: () => void;
};

export function SyncImportTab({ agentId, onProductsSaved }: SyncImportTabProps) {
  const { t } = useTranslation("products");

  // Sub-tabs for Sync & Import methods
  const [subTab, setSubTab] = useState<"fb" | "text" | "manual">("fb");
  const [promptText, setPromptText] = useState("");
  const [textImageUrl, setTextImageUrl] = useState<string | null>(null);
  const [isSubmittingText, setIsSubmittingText] = useState(false);

  // Manual Add Single Item Drawer state
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  // Submit Text Context to AI product extraction & vector embeddings API
  async function handleSaveTextContext() {
    const text = promptText.trim();
    if (!text) {
      toast.error("Please enter product details or context text.");
      return;
    }

    setIsSubmittingText(true);
    try {
      const res = await fetch(`/api/chatbots/${agentId}/products/text-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageUrl: textImageUrl ?? undefined }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze & save text context");
      }

      const data = await res.json();
      toast.success(
        `AI successfully structured & saved ${data.count || 1} product(s) to catalog!`
      );
      setPromptText("");
      setTextImageUrl(null);
      onProductsSaved();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to analyze text context.";
      toast.error(message);
    } finally {
      setIsSubmittingText(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub-tab pills */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        <button
          onClick={() => setSubTab("fb")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "fb"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Share2 className="w-4 h-4 text-blue-400" />
          {t("tabs.fbSync")}
        </button>

        <button
          onClick={() => setSubTab("text")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "text"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <FileText className="w-4 h-4 text-violet-400" />
          {t("tabs.text")}
        </button>

        <button
          onClick={() => setSubTab("manual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
            subTab === "manual"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          {t("tabs.csv")}
        </button>
      </div>

      {/* Sub-tab 1: Social Post Auto-Sync */}
      {subTab === "fb" && (
        <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-xs">
          <FBPostSyncSection agentId={agentId} onProductsSaved={onProductsSaved} />
        </div>
      )}

      {/* Sub-tab 2: Plain Text & Context Training Mode */}
      {subTab === "text" && (
        <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-4 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Plain Text & Context Training Mode
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Paste your raw product text, price list, or delivery terms directly. AI Agent will automatically extract product details, colors, sizes, prices, create embeddings & save to catalog.
            </p>
          </div>

          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            disabled={isSubmittingText}
            placeholder="Paste your product list or delivery terms here... E.g. ইরানী বোরখা, কালো, জলপাই, বেগুনী কালার আছে। ফ্রি সাইজ এভেলএবল, প্রাইজ ২৫০০ টাকা।"
            rows={8}
            className="w-full p-4 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono disabled:opacity-50"
          />

          {/* Optional product image uploader */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Product Image{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <ProductImageUploader
              agentId={agentId}
              currentImageUrl={textImageUrl}
              onImageUploaded={setTextImageUrl}
            />
          </div>

          <Button
            onClick={handleSaveTextContext}
            disabled={isSubmittingText || !promptText.trim()}
            className="gap-2"
          >
            {isSubmittingText ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI Extracting & Saving Products...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save & Train AI Agent
              </>
            )}
          </Button>
        </div>
      )}

      {/* Sub-tab 3: Manual CSV & Sheet Upload */}
      {subTab === "manual" && (
        <div className="bg-card border border-border/60 rounded-2xl p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Manual CSV & Sheet Upload</h3>
              <p className="text-xs text-muted-foreground">
                Upload Google Sheet CSV export or add products manually one by one.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddDrawerOpen(true)}
              className="gap-2 rounded-xl text-xs font-semibold h-9 border-primary/40 text-primary hover:bg-primary/10 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              + Add Single Item
            </Button>
          </div>

          {/* CSV File Drag & Drop Batch Uploader */}
          <CSVBatchUploader agentId={agentId} onSuccess={onProductsSaved} />

          {/* Right-Side Add Single Product Drawer */}
          <AddSingleProductDrawer
            agentId={agentId}
            isOpen={isAddDrawerOpen}
            onClose={() => setIsAddDrawerOpen(false)}
            onSuccess={onProductsSaved}
          />
        </div>
      )}
    </div>
  );
}
