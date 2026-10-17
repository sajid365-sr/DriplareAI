"use client";

import type { UiChatModelConfig, UiProviderName } from "@/components/chatbots/use-openrouter-models";
import { MIN_COMPARE_MODELS } from "@/lib/domain/compare-config";

import { ModelColumn } from "./model-column";
import type { CompareChatMessage } from "./types";

/**
 * কলাম-সংখ্যা অনুযায়ী গ্রিড।
 *
 * ⚠️ `grid-cols-${n}` লেখা যেত না — Tailwind v4 সোর্স **লেখা** স্ক্যান করে
 *    ক্লাস খোঁজে, তাই গড়ে-তোলা নাম কখনো CSS-এ পৌঁছাত না। পুরো নামগুলো এখানে
 *    হুবহু থাকতে হয়।
 *
 * ⚠️ মোবাইলে সবসময় এক কলাম: ৩৭৫px-এ চারটে পাশাপাশি কলাম মানে প্রতি কলামে
 *    ~৮০px — অর্থাৎ পড়া অসম্ভব। তাই ফোনে সাজানো (stacked), আর চওড়া স্ক্রিনে
 *    পাশাপাশি; ৩/৪ কলাম কেবল xl-এ, কারণ ১২৮০px-এর নিচে চার কলামে উত্তর
 *    কাটাকাটি হয়ে যায়।
 */
const GRID_COLUMNS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

interface ArenaGridProps {
  /** কলামের ক্রম — প্রতিটা একটা মডেল key (`"provider|model"`) */
  slots: string[];
  conversation: CompareChatMessage[];
  busy: boolean;
  loadingMessages: boolean;
  loadingModels: boolean;
  copiedKey: string | null;
  /** কোন কলামের মডেল-ড্রপডাউন খোলা */
  openSlot: number | null;
  models: UiChatModelConfig[];
  groupedModels: Record<UiProviderName, UiChatModelConfig[]>;
  onSlotChange: (index: number, value: string) => void;
  onOpenSlotChange: (index: number | null) => void;
  onRemoveSlot: (index: number) => void;
  onCopy: (text: string, key: string) => void;
}

/** ArenaGrid — কতগুলো মডেল পাশাপাশি, তা কেবল `slots`-এর দৈর্ঘ্যই ঠিক করে। */
export function ArenaGrid({
  slots,
  conversation,
  busy,
  loadingMessages,
  loadingModels,
  copiedKey,
  openSlot,
  models,
  groupedModels,
  onSlotChange,
  onOpenSlotChange,
  onRemoveSlot,
  onCopy,
}: ArenaGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-6 ${GRID_COLUMNS[slots.length] ?? GRID_COLUMNS[2]}`}>
      {slots.map((value, index) => (
        <ModelColumn
          key={index}
          index={index}
          value={value}
          onValueChange={(v) => onSlotChange(index, v)}
          open={openSlot === index}
          onOpenChange={(open) => onOpenSlotChange(open ? index : null)}
          conversation={conversation}
          busy={busy}
          loadingMessages={loadingMessages}
          copiedKey={copiedKey}
          onCopy={onCopy}
          models={models}
          groupedModels={groupedModels}
          loadingModels={loadingModels}
          // সর্বনিম্ন দুইটা কলাম লাগে — তাই তখন আর সরানোর বোতামই আঁকা হয় না
          onRemove={slots.length > MIN_COMPARE_MODELS ? () => onRemoveSlot(index) : undefined}
        />
      ))}
    </div>
  );
}
