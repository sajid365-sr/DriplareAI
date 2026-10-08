import {
  getModelKey,
  type UiChatModelConfig,
} from "@/components/chatbots/use-openrouter-models";
import type { CompareChatMessage, CompareReply } from "./types";

/** DB-তে সংরক্ষিত মেসেজের আকৃতি (যতটুকু এখানে লাগে) */
export interface CompareDbMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string | Date;
}

/**
 * অ্যাসিস্ট্যান্ট মেসেজের প্রিফিক্স — `[GPT-4o Mini]: আসল উত্তর`
 *
 * ⚠️ এই ফরম্যাটে লেখার কারণেই পুরনো সেশন পড়া যায়। সার্ভারে লেখার সময়
 *    (`compare/route.ts`) একই নিয়ম মানা হয় — একদিক বদলালে অন্যদিকও বদলাতে হবে,
 *    নইলে ইতিহাসের প্রতিটা উত্তর "কোন মডেলের" তথ্যটা হারাবে।
 */
const LABEL_PREFIX = /^\[([^\]]+)\]:\s*([\s\S]*)$/;

function keyForLabel(models: UiChatModelConfig[], label: string): string {
  const found = models.find((m) => m.label === label);
  return found ? getModelKey(found) : "";
}

export interface ParsedCompareHistory {
  conversation: CompareChatMessage[];
  /** প্রথম assistant টার্ন থেকে উদ্ধার করা কলামের ক্রম — মডেল-সিলেক্টর ফেরাতে */
  slots: string[];
}

/**
 * DB-র সারি থেকে স্ক্রিনের কথোপকথন।
 *
 * ⚠️ একটা assistant টার্ন DB-তে **একাধিক সারি** হয়ে থাকে (প্রতি মডেল একটা),
 *    পরপর। তাই এখানে সেগুলো আবার একটা টার্নে জোড়া লাগানো হয় — নইলে ৪ মডেলের
 *    তুলনা ৪টা আলাদা টার্নের মতো দেখাত, আর প্রতিটা কলামে বাকি মডেলগুলোর উত্তর
 *    "নেই" হয়ে যেত।
 */
export function parseCompareHistory(
  dbMessages: CompareDbMessage[],
  models: UiChatModelConfig[]
): ParsedCompareHistory {
  const conversation: CompareChatMessage[] = [];
  const slots: string[] = [];

  for (const m of dbMessages) {
    if (m.role === "user") {
      conversation.push({
        id: m.id,
        role: "user",
        content: m.content,
        timestamp: new Date(m.timestamp),
      });
      continue;
    }

    if (m.role !== "assistant") continue;

    const match = m.content.match(LABEL_PREFIX);
    const label = match ? match[1] : "";
    const reply: CompareReply = {
      key: keyForLabel(models, label),
      label,
      content: match ? match[2] : m.content,
    };

    const last = conversation[conversation.length - 1];
    if (last && last.role === "assistant" && last.replies) {
      last.replies.push(reply);
    } else {
      conversation.push({
        id: m.id,
        role: "assistant",
        replies: [reply],
        timestamp: new Date(m.timestamp),
      });
      slots.push(reply.key);
    }
  }

  return { conversation, slots };
}
