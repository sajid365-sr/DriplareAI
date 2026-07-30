"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Package, FileText, Upload, RefreshCw, Plus, Sparkles, Check } from "lucide-react";
import { FacebookIcon } from "@/components/icons/PlatformIcons";
import { Button } from "@/components/ui/button";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState<"fb" | "text" | "manual">("fb");
  const [syncing, setSyncing] = useState(false);
  const [promptText, setPromptText] = useState("");

  const handleFbSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Products & Catalog Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Low-friction social commerce catalog: Sync FB posts, paste plain text policies, or upload CSV.
          </p>
        </div>
      </div>

      {/* 3-Tab Strategy Nav */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <button
          onClick={() => setActiveTab("fb")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "fb"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <FacebookIcon className="w-4 h-4 text-[#1877F2]" />
          FB Post Auto-Sync
        </button>

        <button
          onClick={() => setActiveTab("text")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "text"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <FileText className="w-4 h-4 text-violet-400" />
          Text / Prompt Context
        </button>

        <button
          onClick={() => setActiveTab("manual")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "manual"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <Upload className="w-4 h-4 text-emerald-400" />
          Manual & Sheet CSV
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "fb" && (
        <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Facebook Page Post Auto-Sync</h3>
              <p className="text-xs text-muted-foreground">
                Fetch your latest FB page posts and automatically parse product titles, prices & photos via LLM Vision.
              </p>
            </div>

            <Button
              onClick={handleFbSync}
              disabled={syncing}
              className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing Posts..." : "Sync Products Now"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border/40 rounded-xl p-4 bg-muted/20 space-y-3">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-xs">
                  Facebook Post Media #{i}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Panjabi Collection #{i}</span>
                  <span className="text-xs font-bold text-emerald-400">৳ 2,200</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  100% Pure Premium Cotton Panjabi for Eid Collection. Includes free home delivery across BD.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "text" && (
        <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Plain Text & Context Training Mode
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Paste your raw product text, price list, or delivery terms directly. AI Agent will learn it instantly without rigid table entries.
            </p>
          </div>

          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Paste your product list or delivery terms here... E.g. Panjabi White size L price 2200 BDT, Delivery inside Dhaka 70 BDT."
            rows={8}
            className="w-full p-4 bg-muted/40 border border-border/60 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono"
          />

          <Button className="gap-2">
            <Check className="w-4 h-4" />
            Save Context Knowledge
          </Button>
        </div>
      )}

      {activeTab === "manual" && (
        <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Manual CSV & Sheet Upload</h3>
              <p className="text-xs text-muted-foreground">
                Upload Google Sheet CSV export or add products manually.
              </p>
            </div>

            <Button variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Single Item
            </Button>
          </div>

          <div className="border-2 border-dashed border-border/60 rounded-xl p-8 text-center flex flex-col items-center gap-3">
            <Upload className="w-8 h-8 text-muted-foreground opacity-40" />
            <p className="text-sm font-medium text-foreground">Drag and drop your catalog CSV here</p>
            <p className="text-xs text-muted-foreground">Supported format: .csv, .xlsx</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
