"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Globe, FileText, Type, Upload, Sparkles, Loader2, X, Pencil, Save, MessageSquare, Download, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useConfirm } from "@/hooks/use-confirm";
import { N8nSourceUploader } from "@/components/integrations/n8n-source-uploader";

type SourceItem = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
  content?: string;
};

const TABS = [
  { id: "files", label: "Files", icon: FileText },
  { id: "text", label: "Text", icon: Type },
  { id: "website", label: "Website", icon: Globe },
  { id: "chat_history", label: "Chat History", icon: MessageSquare },
] as const;

// Facebook Chat History Download Steps
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

export default function Sources() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [items, setItems] = useState<SourceItem[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("files");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [chatHistoryFiles, setChatHistoryFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [n8nConfig, setN8nConfig] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatHistoryInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm((state) => state.confirm);

  const load = async () => {
    if (!chatbotId) return;
    const r = await fetch(`/api/chatbots/${chatbotId}/sources`);
    const data = await r.json();
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!chatbotId) return;
    void (async () => {
      const response = await fetch(`/api/chatbots/${chatbotId}/sources`);
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);

      // Fetch n8n config
      const intRes = await fetch(`/api/chatbots/${chatbotId}/integrations`);
      const integrations = await intRes.json();
      const n8nSource = integrations.find((i: any) => i.platform === "n8n_source" && i.connected);
      if (n8nSource) setN8nConfig(n8nSource.config);
    })();
  }, [chatbotId]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...incomingFiles]);
    // Reset input value so the same file can be re-selected and
    // the picker doesn't hang on subsequent clicks
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadSelectedFiles = async () => {
    if (files.length === 0) return;
    setBusy(true);
    const uploadedNames: string[] = [];
    const failedNames: string[] = [];

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/chatbots/${chatbotId}/sources/file`, {
          method: "POST",
          body: formData,
        });

        // n8n sometimes returns 200 with an errorMessage body on workflow failure
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Upload failed" }));
          failedNames.push(file.name);
          toast.error(error.error || `Upload failed for: ${file.name}`);
          continue;
        }

        // Also check the response body for n8n workflow-level errors
        const body = await response.json().catch(() => ({}));
        if (body?.errorMessage) {
          failedNames.push(file.name);
          toast.error(`Processing failed for ${file.name}: ${body.errorMessage}`);
          continue;
        }

        uploadedNames.push(file.name);
      }

      if (uploadedNames.length > 0) {
        toast.success(`${uploadedNames.length} file(s) uploaded successfully`);
        await load();
      }

      if (uploadedNames.length > 0 || failedNames.length > 0) {
        setFiles([]);
        // Reset file input so the picker works immediately on next click
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  // ── CSV Template Download ─────────────────────────────────────────────────
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

  // ── Chat History Upload ───────────────────────────────────────────────────
  const handleChatHistoryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    setChatHistoryFiles((prev) => [...prev, ...incoming]);
    e.target.value = "";
  };

  const removeChatHistoryFile = (index: number) => {
    setChatHistoryFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadChatHistory = async () => {
    if (chatHistoryFiles.length === 0) return;
    setBusy(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of chatHistoryFiles) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/sources/chat-history`, {
          method: "POST",
          body: formData,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(body.error || `Upload failed: ${file.name}`);
          failCount++;
        } else {
          toast.success(
            `"${file.name}" থেকে ${body.pairsIngested ?? 0}টি কথোপকথন শেখানো হয়েছে!`
          );
          successCount++;
        }
      } catch {
        toast.error(`Upload failed for ${file.name}`);
        failCount++;
      }
    }

    if (successCount > 0) {
      await load();
      setChatHistoryFiles([]);
      if (chatHistoryInputRef.current) chatHistoryInputRef.current.value = "";
    }
    setBusy(false);
  };

  const addText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/sources/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Text", content: text }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to add text" }));
        throw new Error(error.error || "Failed to add text");
      }

      setText("");
      toast.success("Text knowledge source added successfully");
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add text";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const addUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/sources/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to fetch website" }));
        throw new Error(error.error || "Failed to fetch website");
      }

      setUrl("");
      toast.success("Website content fetched and added successfully");
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch website";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (sourceId: string) => {
    confirm(
      "Delete Knowledge Source",
      "Are you sure you want to delete this source? Your AI will no longer have access to this information.",
      async () => {
        setBusy(true);
        try {
          const response = await fetch(`/api/chatbots/${chatbotId}/sources/${sourceId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Failed to delete source" }));
            throw new Error(error.error || "Failed to delete source");
          }

          toast.success("Knowledge source deleted successfully");
          await load();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Failed to delete source";
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }
    );
  };

  const handleEdit = (source: SourceItem) => {
    setEditingSource(source);
    if (source.type === "text") {
      setEditValue(source.content || "");
    } else if (source.type === "website") {
      setEditUrl(source.name || "");
      setEditValue(source.content || "");
    }
  };

  const saveEdit = async () => {
    if (!editingSource) return;
    setBusy(true);
    try {
      const body: any = {};
      if (editingSource.type === "text") {
        body.content = editValue;
      } else if (editingSource.type === "website") {
        body.url = editUrl;
        body.content = editValue; // Fallback if no re-crawl needed or manual edit
      }

      const response = await fetch(`/api/chatbots/${chatbotId}/sources/${editingSource.sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to update source" }));
        throw new Error(error.error || "Failed to update source");
      }

      toast.success("Knowledge source updated successfully");
      setEditingSource(null);
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update source";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };


  const totalChars = items.reduce((sum, item) => sum + (item.charCount || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <h1 className="text-2xl font-bold tracking-tight">Sources</h1>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-border/60 bg-secondary/10 font-semibold text-sm">Data Sources:</div>

            <div className="flex flex-col md:flex-row h-full min-h-[400px]">
              <div className="w-full md:w-48 bg-secondary/20 p-3 space-y-1 border-r border-border/60">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "bg-card text-primary shadow-sm border border-border/40"
                        : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                    }`}
                  >
                    <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? "text-primary" : ""}`} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-8">
                <AnimatePresence mode="wait">
                  {activeTab === "files" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl p-16 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                        <Upload className="w-10 h-10 text-muted-foreground mb-4 group-hover:text-primary transition-colors" />
                        <div className="font-semibold text-center">Drag & drop files here, or click to select files</div>
                        <div className="text-[11px] text-muted-foreground mt-2 bg-secondary/50 px-4 py-1.5 rounded-full border border-border/40">
                          Supported: .pdf, .docx, .doc, .xlsx, .xls, .csv, .txt, .html, .htm
                        </div>
                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFiles} accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.html,.htm" />
                      </label>
                      {files.length > 0 && (
                        <div className="mt-6 space-y-4">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">Attached Files</div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {files.map((file, index) => (
                              <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 group">
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-medium truncate">{file.name}</span>
                                </div>
                                <button onClick={() => removeFile(index)} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <Button onClick={uploadSelectedFiles} disabled={busy} className="rounded-full">
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload selected files"}
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "text" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Manual Content</Label>
                      <Textarea
                        rows={10}
                        placeholder="Paste your text knowledge here..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="rounded-2xl bg-secondary/10 focus:ring-primary/20"
                        data-testid="src-text-input"
                      />
                      <Button onClick={addText} disabled={busy} className="rounded-full" data-testid="src-text-add">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Text"}
                      </Button>
                    </motion.div>
                  )}

                  {activeTab === "chat_history" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">

                      {/* Header */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">চ্যাট হিস্ট্রি দিয়ে AI ট্রেন করুন</p>
                          <p className="text-xs text-muted-foreground">আপনার আগের কাস্টমার চ্যাট আপলোড করুন, AI আপনার টোনে কথা বলতে শিখবে।</p>
                        </div>
                      </div>

                      {/* Facebook Download Steps */}
                      <div className="rounded-2xl border border-border/60 bg-secondary/10 overflow-hidden">
                        <div className="px-4 py-3 bg-[#1877F2]/10 border-b border-[#1877F2]/20 flex items-center gap-2">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                          <span className="text-xs font-bold text-[#1877F2]">Facebook Messenger থেকে চ্যাট ডাউনলোড করুন</span>
                        </div>
                        <div className="p-4 space-y-3">
                          {FB_DOWNLOAD_STEPS.map((s, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <div className="shrink-0 w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">{s.step}</div>
                              <div>
                                <p className="text-xs font-semibold">{s.title}</p>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
                              </div>
                              {i < FB_DOWNLOAD_STEPS.length - 1 && <ChevronRight className="shrink-0 w-3 h-3 text-border mt-2 ml-auto" />}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CSV Template Download */}
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

                      {/* File Uploader */}
                      <div className="space-y-3">
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl p-10 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                          <Upload className="w-8 h-8 text-muted-foreground mb-3 group-hover:text-primary transition-colors" />
                          <div className="font-semibold text-center text-sm">CSV বা JSON ফাইল আপলোড করুন</div>
                          <div className="text-[11px] text-muted-foreground mt-1.5 bg-secondary/50 px-4 py-1.5 rounded-full border border-border/40">
                            Supported: .csv, .json (Facebook export)
                          </div>
                          <input
                            ref={chatHistoryInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleChatHistoryFiles}
                            accept=".csv,.json"
                          />
                        </label>

                        {chatHistoryFiles.length > 0 && (
                          <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase text-muted-foreground">নির্বাচিত ফাইলসমূহ</div>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {chatHistoryFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40">
                                  <div className="flex items-center gap-2 truncate">
                                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-xs font-medium truncate">{file.name}</span>
                                  </div>
                                  <button onClick={() => removeChatHistoryFile(idx)} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <Button onClick={uploadChatHistory} disabled={busy} className="rounded-full">
                              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 mr-2" />AI-কে ট্রেন করুন</>}
                            </Button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "website" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Website URL</Label>
                      <Input
                        placeholder="https://example.com/docs"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="h-11 rounded-xl bg-secondary/10"
                        data-testid="src-url-input"
                      />
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-primary/80 leading-relaxed">
                        We&apos;ll crawl the provided URL, extract the text content, and clean it automatically for training your AI agent.
                      </div>
                      <Button onClick={addUrl} disabled={busy} className="rounded-full" data-testid="src-url-add">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crawl & Add"}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-card rounded-3xl border border-border/60 shadow-sm sticky top-24">
            <div className="flex items-center gap-2 text-sm font-bold mb-6 text-foreground">
              <Sparkles className="w-4 h-4 text-primary" /> Sources Summary
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Sources</span>
                <span className="font-bold">{items.length}</span>
              </div>
              
              <div className="h-px bg-border/50 my-2" />
              
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Files</span>
                </div>
                <span className="font-semibold">{items.filter(i => i.type === "file").length}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Websites</span>
                </div>
                <span className="font-semibold">{items.filter(i => i.type === "website").length}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Type className="w-3.5 h-3.5" />
                  <span>Text Sources</span>
                </div>
                <span className="font-semibold">{items.filter(i => i.type === "text").length}</span>
              </div>

              <div className="h-px bg-border/50 my-2" />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                  <span>Knowledge Size</span>
                  <span>{totalChars.toLocaleString()} chars</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-fuchsia-500" 
                    style={{ width: `${Math.min((totalChars / 1000000) * 100, 100)}%` }} 
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-right">Limit: 1M characters</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {n8nConfig?.ingestUrl && (
        <N8nSourceUploader chatbotId={chatbotId} ingestUrl={n8nConfig.ingestUrl} />
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">Knowledge Base</div>
        {items.length === 0 && <div className="p-10 text-center text-muted-foreground">No sources yet</div>}
        {items.map((source) => (
          <div key={source.sourceId} className="px-6 py-4 flex items-center justify-between border-b border-border last:border-0" data-testid={`source-${source.sourceId}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {source.type === "file" ? <FileText className="w-4 h-4" /> : source.type === "website" ? <Globe className="w-4 h-4" /> : <Type className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-sm font-medium truncate max-w-md">{source.name}</div>
                <div className="text-xs text-muted-foreground">{source.charCount?.toLocaleString() || 0} chars · {source.type}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-muted-foreground hover:text-primary" 
                onClick={() => handleEdit(source)}
                data-testid={`edit-src-${source.sourceId}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(source.sourceId)} data-testid={`del-src-${source.sourceId}`}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingSource && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/10">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-primary" /> Edit Source
                </h3>
                <button onClick={() => setEditingSource(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {editingSource.type === "file" ? (
                  <div className="text-center py-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="font-medium text-foreground">File sources cannot be edited directly.</div>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      To update a PDF or Word document, please delete this source and upload a new version.
                    </p>
                  </div>
                ) : (
                  <>
                    {editingSource.type === "website" && (
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase text-muted-foreground">Website URL (Changing this will re-crawl)</Label>
                        <Input 
                          value={editUrl} 
                          onChange={(e) => setEditUrl(e.target.value)} 
                          className="rounded-xl bg-secondary/10"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">
                        {editingSource.type === "website" ? "Manual Content Override" : "Text Content"}
                      </Label>
                      <Textarea 
                        rows={12}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="rounded-xl bg-secondary/10 font-sans leading-relaxed"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-border bg-secondary/5 flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setEditingSource(null)} className="rounded-full">Cancel</Button>
                {editingSource.type !== "file" && (
                  <Button onClick={saveEdit} disabled={busy} className="rounded-full px-6">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
                  </Button>
                )}
                {editingSource.type === "file" && (
                  <Button variant="destructive" onClick={() => { del(editingSource.sourceId); setEditingSource(null); }} className="rounded-full px-6">
                    Delete & Upload New
                  </Button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>

  );
}
