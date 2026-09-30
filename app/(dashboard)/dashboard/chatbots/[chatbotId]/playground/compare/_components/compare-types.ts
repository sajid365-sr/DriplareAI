// Shared types for the Model Comparison feature

/**
 * একটা মডেলের একটা উত্তর।
 *
 * ⚠️ `key` হলো `"provider|model"` — অর্থাৎ ঠিক যেটা মডেল-সিলেক্টরে বসে
 *    (`getModelKey`)। ইতিহাস থেকে সেশন ফেরত আনার সময় এটাই দরকার: label দেখে
 *    মডেল খুঁজলে admin কোনো মডেল rename করলেই পুরনো সেশন ভুল মডেল বেছে নিত।
 */
export interface CompareReply {
  /** মডেলের key — `"openrouter|openai/gpt-4o"` */
  key: string;
  /** স্ক্রিনে দেখানোর নাম */
  label: string;
  content: string;
}

/**
 * একটা টার্ন।
 *
 * ⚠️ আগে আকৃতিটা ছিল `contentA/contentB` জোড়া — অর্থাৎ টাইপের ভেতরেই
 *    "ঠিক দুইটা মডেল" লেখা ছিল। ২/৩/৪ করতে গিয়ে সেটাই প্রথম ভাঙতে হয়েছে:
 *    এখন ইউজার-টার্নে `content`, আর অ্যাসিস্ট্যান্ট-টার্নে `replies[]` —
 *    array-এর ক্রমই কলামের ক্রম, তাই মডেল সংখ্যা যত খুশি।
 */
export interface CompareChatMessage {
  id: string;
  role: "user" | "assistant";
  /** ইউজারের লেখা — শুধু `role: "user"` টার্নে */
  content?: string;
  /** প্রতি মডেলের একটা উত্তর — শুধু `role: "assistant"` টার্নে */
  replies?: CompareReply[];
  timestamp: Date;
}

export interface CompareSession {
  sessionId: string;
  title: string;
  platform: string;
  isActive: boolean;
  timestamp: string;
}
