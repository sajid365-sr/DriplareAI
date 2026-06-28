"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

export function CsvTemplateCard() {
  const downloadCsvTemplate = () => {
    const csv = `question,answer
"আপনার পণ্যের দাম কত?","আমাদের পণ্যের দাম ৫০০ টাকা থেকে শুরু। নির্দিষ্ট পণ্যের দাম জানতে আমাদের শপ ভিজিট করুন।"
"ডেলিভারি চার্জ কত?","ঢাকার ভেতরে ৬০ টাকা এবং ঢাকার বাইরে ১২০ টাকা ডেলিভারি চার্জ প্রযোজ্য।"
"পণ্যের মান কেমন?","আমরা সর্বোচ্চ মানের পণ্য সরবরাহ করি। প্রতিটি পণ্য কোয়ালিটি চেক করা হয়।"`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chat_history_template.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV Template ডাউনলোড হয়েছে!");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-emerald-500/5 border-emerald-500/20 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">CSV Template ব্যবহার করুন</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">আমাদের রেডিমেড CSV টেমপ্লেট ডাউনলোড করে পূরণ করুন — সহজেই আপলোড করা যাবে।</p>
      </div>
      <button
        onClick={downloadCsvTemplate}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Template.csv
      </button>
    </div>
  );
}
