"use client";

import { ChevronRight } from "lucide-react";

const FB_DOWNLOAD_STEPS = [
  {
    step: "01",
    title: "Settings & Privacy খুলুন",
    desc: "আপনার ফেসবুক পেজে গিয়ে Settings → Your Facebook Information-এ যান।",
  },
  {
    step: "02",
    title: "Download Profile Information",
    desc: "\"Download profile information\" অপশনে ক্লিক করুন।",
  },
  {
    step: "03",
    title: "শুধু Messages সিলেক্ট করুন",
    desc: "Format: JSON রাখুন। \"Deselect All\" করুন এবং শুধুমাত্র Messages সিলেক্ট করুন।",
  },
  {
    step: "04",
    title: "Request a Download",
    desc: "Request a download বাটনে ক্লিক করুন। ফেসবুক ৫–১৫ মিনিটের মধ্যে ফাইল তৈরি করবে।",
  },
  {
    step: "05",
    title: "Unzip ও Upload করুন",
    desc: "ডাউনলোড করা ZIP ফাইলটি আনজিপ করে এই পেজে আপলোড করুন।",
  },
];

export function FbDownloadGuide() {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/10 overflow-hidden">
      <div className="px-4 py-3 bg-[#1877F2]/10 border-b border-[#1877F2]/20 flex items-center gap-2">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span className="text-xs font-bold text-[#1877F2]">Facebook Messenger থেকে চ্যাট ডাউনলোড করুন</span>
      </div>
      <div className="p-4 space-y-3">
        {FB_DOWNLOAD_STEPS.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="shrink-0 w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
              {s.step}
            </div>
            <div>
              <p className="text-xs font-semibold">{s.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
            {i < FB_DOWNLOAD_STEPS.length - 1 && (
              <ChevronRight className="shrink-0 w-3 h-3 text-border mt-2 ml-auto" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
