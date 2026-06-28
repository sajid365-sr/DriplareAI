"use client";

import { useState } from "react";
import { MessageSquare, FileUp, Sparkles, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FbDownloadGuide } from "../chat-history/fb-download-guide";
import { CsvTemplateCard } from "../chat-history/csv-template-card";
import { ChatHistoryUploader } from "../chat-history/chat-history-uploader";
import { FbConversationPicker } from "../chat-history/fb-conversation-picker";

interface ChatHistoryTabProps {
  chatbotId: string;
  isFacebookConnected: boolean;
  onSuccess: () => void;
}

export function ChatHistoryTab({
  chatbotId,
  isFacebookConnected,
  onSuccess,
}: ChatHistoryTabProps) {
  const [subTab, setSubTab] = useState<"smart_picker" | "file_upload">(
    isFacebookConnected ? "smart_picker" : "file_upload"
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-6"
    >
      {/* Header Info */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold">চ্যাট হিস্ট্রি দিয়ে AI ট্রেন করুন</p>
          <p className="text-xs text-muted-foreground leading-normal">
            আপনার আগের কাস্টমার চ্যাট আপলোড করুন অথবা সরাসরি ফেসবুক থেকে পছন্দমতো চ্যাট সিলেক্ট
            করুন। AI আপনার টোনে কথা বলতে শিখবে।
          </p>
        </div>
      </div>

      {/* Sub tabs switcher if Facebook connected */}
      {isFacebookConnected ? (
        <div className="flex border-b border-border/60">
          <button
            onClick={() => setSubTab("smart_picker")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              subTab === "smart_picker"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Facebook Smart Picker
          </button>
          <button
            onClick={() => setSubTab("file_upload")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              subTab === "file_upload"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            CSV/JSON Upload
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground flex items-start gap-2.5">
          <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold text-foreground">প্রো-টিপ:</span> আপনার ফেসবুক পেজটি
            যদি Driplare-এর সাথে সংযুক্ত থাকে, তবে আপনি চ্যাট হিস্ট্রি ডাউনলোড না করেই সরাসরি পেজের
            conversations ব্রাউজ করে AI ট্রেন করতে পারবেন।
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {subTab === "smart_picker" && isFacebookConnected ? (
          <motion.div
            key="smart_picker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <FbConversationPicker chatbotId={chatbotId} onSuccess={onSuccess} />
          </motion.div>
        ) : (
          <motion.div
            key="file_upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <FbDownloadGuide />
            <CsvTemplateCard />
            <ChatHistoryUploader chatbotId={chatbotId} onSuccess={onSuccess} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
