"use client";

import { motion } from "framer-motion";
import { MessageSquare, Globe, Send, Zap, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";

export default function AIAgentVisual() {
  return (
    <div className="relative w-full max-w-lg mx-auto py-8">
      {/* Background Radial Glow & Light Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-tr from-primary/30 via-violet-600/20 to-fuchsia-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-primary/20 rounded-full pointer-events-none animate-spin-slow" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] border border-dashed border-violet-500/15 rounded-full pointer-events-none" />

      {/* Main 3D AI Robot Illustration Container */}
      <div className="relative z-10 flex items-center justify-center">
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative group"
        >
          {/* Glassmorphic Aura Ring around 3D Robot */}
          <div className="relative rounded-3xl p-3 bg-card/40 backdrop-blur-2xl border border-primary/30 shadow-2xl shadow-primary/20 overflow-hidden">
            <img
              src="/Assets/ai_sales_agent_3d.png"
              alt="DRIPLARE AI Sales Agent 3D"
              className="w-72 sm:w-80 h-auto object-contain rounded-2xl drop-shadow-[0_20px_35px_rgba(124,58,237,0.35)]"
            />
          </div>

          {/* Active AI Status Glow Tag */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-md border border-emerald-500/40 rounded-full px-4 py-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xl"
          >
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            AI Sales Agent Online
          </motion.div>
        </motion.div>
      </div>

      {/* FLOATING ORBITING CHANNEL BADGES */}

      {/* 1. Facebook Messenger Badge (Top Left) */}
      <motion.div
        animate={{ y: [0, -8, 0], x: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="absolute top-2 -left-4 sm:-left-8 bg-card/90 backdrop-blur-xl border border-[#1877F2]/40 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-xl hover:scale-105 transition-transform z-20"
      >
        <div className="w-8 h-8 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shadow-md">
          <MessageSquare className="w-4 h-4 fill-white" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">Facebook</div>
          <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Auto-Replying
          </div>
        </div>
      </motion.div>

      {/* 2. WhatsApp Business Badge (Top Right) */}
      <motion.div
        animate={{ y: [0, 8, 0], x: [0, 4, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute top-4 -right-4 sm:-right-8 bg-card/90 backdrop-blur-xl border border-[#25D366]/40 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-xl hover:scale-105 transition-transform z-20"
      >
        <div className="w-8 h-8 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-md">
          <MessageSquare className="w-4 h-4 fill-white" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">WhatsApp</div>
          <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Order Captured
          </div>
        </div>
      </motion.div>

      {/* 3. Instagram Direct Badge (Bottom Left) */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
        className="absolute bottom-6 -left-2 sm:-left-6 bg-card/90 backdrop-blur-xl border border-[#E1306C]/40 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-xl hover:scale-105 transition-transform z-20"
      >
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#F56040] via-[#E1306C] to-[#833AB4] text-white flex items-center justify-center shadow-md">
          <Globe className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">Instagram</div>
          <div className="text-[10px] text-muted-foreground font-medium">DM Sales Active</div>
        </div>
      </motion.div>

      {/* 4. Telegram Bot Badge (Bottom Right) */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
        className="absolute bottom-8 -right-2 sm:-right-6 bg-card/90 backdrop-blur-xl border border-[#229ED9]/40 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 shadow-xl hover:scale-105 transition-transform z-20"
      >
        <div className="w-8 h-8 rounded-xl bg-[#229ED9] text-white flex items-center justify-center shadow-md">
          <Send className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">Telegram</div>
          <div className="text-[10px] text-muted-foreground font-medium">Instant Bot</div>
        </div>
      </motion.div>

      {/* 5. Performance Speed Badge (Top Center Floating Chip) */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-md border border-border shadow-lg rounded-full px-3.5 py-1 flex items-center gap-1.5 text-[11px] font-semibold z-30"
      >
        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        <span>&lt; 3s Instant Response</span>
      </motion.div>
    </div>
  );
}
