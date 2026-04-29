"use client";

import { motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";

export default function FloatingBubbles() {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3" data-testid="floating-bubbles">
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
        className="w-12 h-12 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center animate-pulse-ring"
        data-testid="float-chat"
      >
        <MessageCircle className="w-5 h-5" />
      </motion.button>
    </div>
  );
}
