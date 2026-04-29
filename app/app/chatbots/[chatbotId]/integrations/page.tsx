"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, Code2, Globe, Webhook, Send, Hash, Plug, MessageSquare, Smartphone, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Script from "next/script";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ICONS: any = { facebook: MessageSquare, instagram: Smartphone, whatsapp: MessageCircle, custom_api: Code2, website: Globe, webhook: Webhook, telegram: Send, slack: Hash };

export default function Integrations() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [items, setItems] = useState<any[]>([]);
  
  // FB specific states
  const [fbPages, setFbPages] = useState<any[]>([]);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
 
  // WhatsApp specific states
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waForm, setWaForm] = useState({
    accessToken: "",
    phoneNumberId: "",
    wabaId: ""
  });

  const load = async () => {
    if (!chatbotId) return;
    const r = await fetch(`/api/chatbots/${chatbotId}/integrations`);
    const data = await r.json();
    setItems(Array.isArray(data) ? data : []);
  };
  useEffect(() => { load(); }, [chatbotId]);

  const toggle = async (it: any) => {
    if (it.coming_soon) { toast.info("Coming soon"); return; }
    
    if (it.platform === "facebook" && !it.connected) {
      handleFacebookConnect();
      return;
    }
 
    if (it.platform === "whatsapp" && !it.connected) {
      setIsWaModalOpen(true);
      return;
    }

    if (it.connected) {
      await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/disconnect`, { method: "POST" });
      toast.success(`${it.name} integration disconnected successfully`);
    } else {
      await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/connect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: {} })
      });
      toast.success(`${it.name} integration connected successfully`);
    }
    load();
  };

  const handleFacebookConnect = () => {
    if (!process.env.NEXT_PUBLIC_FACEBOOK_APP_ID) {
      toast.error("Facebook App ID is not configured in .env");
      return;
    }
    
    // @ts-ignore
    if (!window.FB) {
      toast.error("Facebook SDK loading...");
      return;
    }
    // @ts-ignore
    window.FB.login((response: any) => {
      if (response.authResponse) {
        const token = response.authResponse.accessToken;
        fetchFacebookPages(token);
      } else {
        toast.error("Login cancelled or failed.");
      }
    }, { scope: 'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement', auth_type: 'rerequest' });
  };

  const fetchFacebookPages = async (userToken: string) => {
    setLoadingPages(true);
    setIsFbModalOpen(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations/facebook/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userToken })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to fetch pages");
      setFbPages(data.pages || []);
    } catch (e: any) {
      toast.error(e.message);
      setIsFbModalOpen(false);
    } finally {
      setLoadingPages(false);
    }
  };

  const connectFacebookPage = async () => {
    if (!selectedPageId) return;
    const page = fbPages.find(p => p.id === selectedPageId);
    if (!page) return;

    setLoadingPages(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations/facebook/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: page.id, pageToken: page.access_token, pageName: page.name })
      });
      if (!r.ok) throw new Error("Failed to connect page");
      toast.success(`Facebook Page "${page.name}" connected successfully`);
      setIsFbModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingPages(false);
    }
  };

  const connectWhatsApp = async () => {
    if (!waForm.accessToken || !waForm.phoneNumberId || !waForm.wabaId) {
      toast.error("Please fill in all fields");
      return;
    }

    setWaLoading(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waForm)
      });
      if (!r.ok) throw new Error("Failed to connect WhatsApp");
      toast.success("WhatsApp Business connected successfully");
      setIsWaModalOpen(false);
      setWaForm({ accessToken: "", phoneNumberId: "", wabaId: "" });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWaLoading(false);
    }
  };

  const activeCount = items.filter(i => i.connected).length;

  return (
    <div className="space-y-8 pb-10">
      <Script 
        src="https://connect.facebook.net/en_US/sdk.js" 
        strategy="lazyOnload"
        onLoad={() => {
          // @ts-ignore
          if (window.FB) {
            // @ts-ignore
            window.FB.init({
              appId      : process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || '',
              cookie     : true,
              xfbml      : true,
              version    : 'v20.0'
            });
          }
        }}
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
          <p className="text-muted-foreground mt-1 text-sm">Connect your chatbot to multiple channels and platforms.</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-medium" data-testid="integration-count">
          {activeCount} Connected
        </span>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="text-sm font-medium text-muted-foreground">Active Channels</div>
          <div className="text-4xl font-bold mt-2 text-foreground">{activeCount}</div>
        </div>
        <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Available Platforms</div>
          <div className="text-4xl font-bold mt-2 text-foreground">{items.filter(i => !i.coming_soon).length}</div>
        </div>
        <div className="p-6 rounded-2xl border border-border bg-card/50 backdrop-blur-sm shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Coming Soon</div>
          <div className="text-4xl font-bold mt-2 text-foreground">{items.filter(i => i.coming_soon).length}</div>
        </div>
      </div>

      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {items.map((it) => {
          const Icon = ICONS[it.platform] || Plug;
          return (
            <motion.div key={it.platform} variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }} className="group relative p-6 rounded-2xl border border-border bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden" data-testid={`integration-${it.platform}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              
              {it.connected && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </div>
              )}
              
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mb-5 shadow-inner" style={{ background: it.color }}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg">{it.name}</h3>
              {it.connected && it.config?.pageName ? (
                <p className="text-sm text-muted-foreground mt-1.5 mb-6 line-clamp-2 h-10">
                  Connected to: <span className="font-medium text-foreground">{it.config.pageName}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1.5 mb-6 line-clamp-2 h-10">{it.description}</p>
              )}
              
              <Button 
                onClick={() => toggle(it)} 
                disabled={it.coming_soon} 
                className={`w-full rounded-xl transition-all duration-300 font-medium ${
                  it.connected 
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border-0" 
                    : "bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                }`} 
                variant={it.coming_soon ? "secondary" : (it.connected ? "outline" : "default")}
                data-testid={`toggle-${it.platform}`}
              >
                {it.coming_soon ? "Coming Soon" : it.connected ? "Disconnect" : `Connect`}
                {!it.connected && !it.coming_soon && <ChevronRight className="w-4 h-4 ml-1 opacity-70" />}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>

      <Dialog open={isFbModalOpen} onOpenChange={setIsFbModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect Facebook Page</DialogTitle>
            <DialogDescription>
              Select the Facebook page you want to connect to this chatbot.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {loadingPages ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
                <p className="text-sm">Fetching your pages...</p>
              </div>
            ) : fbPages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No Facebook pages found.</p>
                <p className="text-xs mt-1">Make sure you granted permission for the pages.</p>
              </div>
            ) : (
              fbPages.map(page => (
                <div 
                  key={page.id} 
                  onClick={() => setSelectedPageId(page.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPageId === page.id 
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                    {page.picture?.data?.url ? (
                      <img src={page.picture.data.url} alt={page.name} className="w-full h-full object-cover" />
                    ) : (
                      page.name.charAt(0)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{page.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{page.category}</p>
                  </div>
                  {selectedPageId === page.id && (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFbModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={connectFacebookPage} 
              disabled={!selectedPageId || loadingPages}
            >
              {loadingPages ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Connect Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
 
      {/* WHATSAPP MODAL */}
      <Dialog open={isWaModalOpen} onOpenChange={setIsWaModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect WhatsApp Business</DialogTitle>
            <DialogDescription>
              Enter your Meta WhatsApp Business API credentials. You can find these in your Meta Developer Portal.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">System User Access Token</label>
              <input 
                type="password"
                className="w-full p-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                placeholder="EAAG..."
                value={waForm.accessToken}
                onChange={(e) => setWaForm({...waForm, accessToken: e.target.value})}
              />
              <p className="text-[11px] text-muted-foreground">Recommend using a Permanent System User Token.</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone Number ID</label>
              <input 
                type="text"
                className="w-full p-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                placeholder="109283..."
                value={waForm.phoneNumberId}
                onChange={(e) => setWaForm({...waForm, phoneNumberId: e.target.value})}
              />
            </div>
 
            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp Business Account ID</label>
              <input 
                type="text"
                className="w-full p-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm"
                placeholder="293847..."
                value={waForm.wabaId}
                onChange={(e) => setWaForm({...waForm, wabaId: e.target.value})}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWaModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={connectWhatsApp} 
              disabled={waLoading}
              className="bg-[#25D366] hover:bg-[#20bd5c] text-white border-0"
            >
              {waLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Connect WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
