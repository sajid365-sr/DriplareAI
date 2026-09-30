"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";

export default function FloatingBubbles() {
  const pathname = usePathname();

  // Hide floating support widgets on Playground & Live Inbox pages
  // to avoid overlapping input controls or floating toolbars.
  //
  // ⚠️ `/playground` — টেস্টারের পেজ। পুরনো `/chat` আর কখনো মেলানো হবে না,
  //    কারণ ওটা এখন কেবল একটা redirect stub, যেখানে কেউ থাকে না।
  if (pathname?.includes("/playground") || pathname?.includes("/inbox")) {
    return null;
  }

  // এজেন্ট-সেকশনে নিচের ডান কোণটা টেস্টার-বাবলের (`TesterBubble`)। সাপোর্ট
  // বাবলগুলো ওখানেই থাকলে দুটো একে অন্যের উপর বসে যেত, তাই ওরা এক ধাপ উপরে
  // সরে যায় — নিচে নয়, কারণ কোণাটা স্থির থাকলে চোখ সহজে খুঁজে পায়।
  const isAgentPage = pathname?.includes("/dashboard/chatbots/") ?? false;

  return (
    <div
      className={`fixed right-6 z-50 flex flex-col gap-3 ${isAgentPage ? "bottom-24" : "bottom-6"}`}
      data-testid="floating-bubbles"
    >
      <motion.a
        href="https://wa.me/8801"
        target="_blank"
        rel="noreferrer"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center"
        data-testid="float-whatsapp"
      >
        <Phone className="w-5 h-5" />
      </motion.a>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center animate-pulse-ring"
        data-testid="float-chat"
      >
        <MessageCircle className="w-5 h-5" />
      </motion.button>
    </div>
  );
}
