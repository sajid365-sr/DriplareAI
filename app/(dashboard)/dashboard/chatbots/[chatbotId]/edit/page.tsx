"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Type, Globe, HelpCircle, Upload, Sparkles, Loader2, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CHAT_MODELS } from "@/lib/ai/chat-models";

const TABS = [
  { id: "files", label: "Files", icon: FileText },
  { id: "text", label: "Text", icon: Type },
  { id: "website", label: "Website", icon: Globe },
  { id: "qa", label: "Q/A", icon: HelpCircle },
];

export default function EditChatbot() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const router = useRouter();

  const [name, setName] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [activeTab, setActiveTab] = useState("files");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!chatbotId) return;
    fetch(`/api/chatbots/${chatbotId}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name);
        setModelKey(`${data.provider}|${data.model}`);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load chatbot");
        setLoading(false);
      });
  }, [chatbotId]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...f]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      const [provider, model] = modelKey.split("|");
      
      // Update basic settings
      const r = await fetch(`/api/chatbots/${chatbotId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, model, provider })
      });
      
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Failed to update settings");
      }

      // Upload new sources sequentially
      if (text.trim()) {
        await fetch(`/api/chatbots/${chatbotId}/sources/text`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Text", content: text })
        });
      }
      
      if (url.trim()) {
        try { 
          await fetch(`/api/chatbots/${chatbotId}/sources/website`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url })
          });
        } catch { console.error("Website fetch failed"); }
      }
      
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        try { 
          await fetch(`/api/chatbots/${chatbotId}/sources/file`, { method: "POST", body: fd });
        } catch { console.error(`File upload failed: ${f.name}`); }
      }
      
      toast.success(`Chatbot "${name}" updated successfully!`);
      setText("");
      setUrl("");
      setFiles([]);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to update chatbot");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading chatbot data...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Edit Chatbot</h1>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Header Config */}
          <div className="grid sm:grid-cols-2 gap-6 p-8 bg-card rounded-3xl border border-border/60 shadow-sm">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl bg-secondary/30 border-secondary focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Model</Label>
              <select className="w-full h-11 rounded-xl border border-secondary bg-secondary/30 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20" value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
                {CHAT_MODELS.map((m) => <option key={`${m.provider}|${m.model}`} value={`${m.provider}|${m.model}`}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Sources Section */}
          <div className="bg-card rounded-3xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-8 py-4 border-b border-border/60 bg-secondary/10 font-semibold text-sm">Add More Data Sources:</div>
            
            <div className="flex flex-col md:flex-row h-full min-h-[400px]">
              {/* Left Sidebar Tabs */}
              <div className="w-full md:w-48 bg-secondary/20 p-3 space-y-1 border-r border-border/60">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activeTab === t.id 
                      ? "bg-card text-primary shadow-sm border border-border/40" 
                      : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                    }`}
                  >
                    <t.icon className={`w-4 h-4 ${activeTab === t.id ? "text-primary" : ""}`} />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Right Content Area */}
              <div className="flex-1 p-8">
                <AnimatePresence mode="wait">
                  {activeTab === "files" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-2xl p-16 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                        <Upload className="w-10 h-10 text-muted-foreground mb-4 group-hover:text-primary transition-colors" />
                        <div className="font-semibold text-center">Drag & drop files here, or click to select files</div>
                        <div className="text-[10px] text-muted-foreground mt-2 bg-secondary/50 px-3 py-1 rounded-full border border-border/40">Supported: .pdf, .docx, .doc, .xlsx, .xls, .csv, .txt</div>
                        <input type="file" multiple className="hidden" onChange={handleFiles} accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt" />
                      </label>
                      {files.length > 0 && (
                        <div className="mt-6 space-y-2">
                          <div className="text-xs font-semibold uppercase text-muted-foreground">Attached Files</div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {files.map((f, i) => (
                              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/40 group">
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-xs font-medium truncate">{f.name}</span>
                                </div>
                                <button onClick={() => removeFile(i)} className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === "text" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">Manual Content</Label>
                      <Textarea 
                        rows={10} 
                        placeholder="Paste your text knowledge here…" 
                        value={text} 
                        onChange={(e) => setText(e.target.value)}
                        className="rounded-2xl bg-secondary/10 focus:ring-primary/20"
                      />
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
                      />
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-primary/80 leading-relaxed">
                        We'll crawl the provided URL, extract the text content, and clean it automatically.
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "qa" && (
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-secondary/40 flex items-center justify-center">
                        <HelpCircle className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Q/A Pairs</h4>
                        <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">You can add specific question and answer pairs in the Sources tab for better control.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-8 bg-card rounded-3xl border border-border/60 shadow-sm sticky top-24">
            <div className="flex items-center gap-2 text-sm font-bold mb-6 text-foreground">
              <Sparkles className="w-4 h-4 text-primary" /> Changes Summary
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-bold truncate max-w-[120px]">{name}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">New Files</span>
                <span className="font-bold">{files.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">New Text</span>
                <span className={`font-bold ${text ? "text-primary" : "text-muted-foreground"}`}>{text ? "Detected" : "None"}</span>
              </div>
            </div>

            <Button 
              className="w-full h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-bold transition-all shadow-lg active:scale-[0.98]" 
              disabled={busy} 
              onClick={submit} 
            >
              {busy ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-5 h-5 mr-2" /> Save Changes</>
              )}
            </Button>
            
            <p className="text-[10px] text-center text-muted-foreground mt-4 leading-relaxed">
              Updating your chatbot will re-train its knowledge base. This might take a few seconds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
