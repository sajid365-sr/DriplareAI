"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Globe, FileText, Type, Upload, Sparkles, Loader2, X, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

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
] as const;

export default function Sources() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [items, setItems] = useState<SourceItem[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("files");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceItem | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editUrl, setEditUrl] = useState("");

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
    })();
  }, [chatbotId]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...incomingFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadSelectedFiles = async () => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/chatbots/${chatbotId}/sources/file`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(error.error || `Upload failed for ${file.name}`);
        }
      }

      setFiles([]);
      toast.success("Files uploaded");
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setBusy(false);
    }
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
      toast.success("Text source added");
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
      toast.success("Website source added");
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch website";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (sourceId: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/sources/${sourceId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Failed to delete source" }));
        throw new Error(error.error || "Failed to delete source");
      }

      toast.success("Source deleted");
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete source";
      toast.error(message);
    } finally {
      setBusy(false);
    }
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

      toast.success("Source updated");
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
                        <div className="text-xs text-muted-foreground mt-2">Supported: .pdf, .docx, .txt</div>
                        <input type="file" multiple className="hidden" onChange={handleFiles} accept=".pdf,.docx,.txt" />
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

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Sources</span>
                <span className="font-bold">{items.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Queued Files</span>
                <span className={`font-bold ${files.length ? "text-primary" : "text-muted-foreground"}`}>{files.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Knowledge Size</span>
                <span className="font-bold">{totalChars.toLocaleString()} chars</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Draft Text</span>
                <span>{text.length.toLocaleString()}/500,000</span>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min((text.length / 500000) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

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
