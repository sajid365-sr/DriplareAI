"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Play, Pause, Sparkles, Volume2, VolumeX, ShieldCheck } from "lucide-react";

export default function DemoSection() {
  const { t } = useTranslation("home");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn("Autoplay fallback:", err);
          setIsPlaying(false);
        });
    }
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <section id="demo" className="py-20 md:py-28 relative overflow-hidden bg-background">
      {/* Ambient Radial Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-primary/15 via-violet-500/10 to-fuchsia-500/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 md:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t("demo.badge")}
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight"
          >
            {t("demo.title")}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-base sm:text-lg text-muted-foreground"
          >
            {t("demo.subtitle")}
          </motion.p>
        </div>

        {/* Full Horizontal Screen Embedded Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative w-full rounded-2xl sm:rounded-3xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden group cursor-pointer"
          onClick={togglePlay}
        >
          {/* Live Status Chip Badge */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-border/60 text-xs font-medium shadow-md">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Live Interactive Demo
            </span>
          </div>

          {/* Full Horizontal Screen Video Player */}
          <div className="relative aspect-[16/9] md:aspect-[21/9] lg:aspect-[2.35/1] w-full bg-black/90 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
            >
              <source src="/Assets/AIAgentDemo.mp4" type="video/mp4" />
              Your browser does not support video playback.
            </video>

            {/* Subtle Gradient Overlays to blend with page borders */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/40 via-transparent to-background/20" />

            {/* Custom Control Bar (Bottom Right) */}
            <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 bg-background/80 backdrop-blur-md border border-border/60 rounded-full px-3 py-1.5 text-foreground text-xs z-20 shadow-lg opacity-90 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="hover:text-primary transition-colors p-1"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-foreground" />}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="hover:text-primary transition-colors p-1"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-amber-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-500" />
                )}
              </button>
            </div>

            {/* Overlay Play Icon when paused */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
