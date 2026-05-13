"use client";

import { Save, Loader2, Info, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAT_MODELS } from "@/lib/chat-models";
import { DEMO_PROMPTS } from "@/lib/demo-prompts";
import { toast } from "sonner";

interface ChatSettingsProps {
  bot: any;
  saving: boolean;
  onBotChange: (key: string, val: any) => void;
  onModelSelect: (key: string) => void;
  onSave: () => void;
}

export const ChatSettings = ({ bot, saving, onBotChange, onModelSelect, onSave }: ChatSettingsProps) => {
  return (
    <div className="lg:col-span-2 space-y-6">
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Bot Configuration</h2>
            <p className="text-xs text-muted-foreground">Define how your AI assistant behaves and which model it uses.</p>
          </div>
          <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5 px-4 shadow-md transition-all hover:scale-105">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </Button>
        </div>

        <div className="space-y-8">
          {/* Model Selection Dropdown */}
          <div className="space-y-3">
            <label className="text-sm font-semibold flex items-center gap-2">
              AI Brain (Model)
              <span className="text-[10px] font-normal bg-primary/10 text-primary px-1.5 py-0.5 rounded">Recommended: Gemini 1.5 Flash</span>
            </label>
            <select
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer hover:border-primary/50"
              value={`${bot.provider}|${bot.model}`}
              onChange={(e) => onModelSelect(e.target.value)}
            >
              {CHAT_MODELS.map(m => (
                <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>
                  {m.label} {m.note ? `— ${m.note}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-6 pt-2">
            <div className="space-y-3">
              <label className="text-sm font-bold flex items-center gap-2">
                System Prompt (বটের পরিচয় ও কাজ)
              </label>

              {/* High-contrast, clean Info Box for maximum readability with violet gradient */}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary via-violet-500 to-indigo-500 border-l-4 border-l-white/30 shadow-xl transition-all">
                <div className="bg-white/20 p-2 rounded-full shrink-0">
                  <Info className="w-5 h-5 text-white" />
                </div>
                <div className="space-y-1">
                  <p className="text-[14px] font-bold text-white leading-none">
                    বটের পরিচয় ও কাজের বিবরণ (Identity)
                  </p>
                  <p className="text-[13px] text-white/90 leading-relaxed font-medium">
                    এখানে বিস্তারিত লিখে দিন আপনার এআই অ্যাসিস্ট্যান্ট কে এবং তাকে কাস্টমারদের সাথে কীভাবে কথা বলতে হবে। এটি যত বিস্তারিত হবে, আপনার বট তত বুদ্ধিমান হবে।
                  </p>
                </div>
              </div>
            </div>

            <textarea
              value={bot.systemPrompt}
              onChange={(e) => onBotChange("systemPrompt", e.target.value)}
              className="w-full h-72 bg-muted/20 border border-border rounded-2xl p-5 text-[15px] focus:ring-2 focus:ring-primary/50 outline-none resize-none transition-all leading-relaxed shadow-inner"
              placeholder="Example: You are a friendly customer support agent for Driplare AI..."
            />

            {/* Demo Prompts / Identity Templates */}
            <div className="space-y-4 pt-4 border-t border-border">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                Quick Setup Templates
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DEMO_PROMPTS.map((p) => (
                  <button
                    key={p.title}
                    onClick={() => {
                      onBotChange("systemPrompt", p.content);
                      toast.info(`${p.title} template applied!`);
                    }}
                    className="flex flex-col gap-1 px-4 py-3 text-left border border-border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all group relative overflow-hidden"
                  >
                    <span className="font-bold text-[12px] truncate group-hover:text-primary transition-colors">{p.title}</span>
                    <span className="text-[10px] text-muted-foreground line-clamp-1">Click to apply template</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
