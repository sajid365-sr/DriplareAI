"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Code2, Globe, Webhook, Plug } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

import { WhatsAppIcon, InstagramIcon, MessengerIcon, TikTokIcon, SlackIcon, TelegramIcon } from "@/components/icons/PlatformIcons";
import { IntegrationHeader } from "./_components/IntegrationHeader";
import { PlatformCard } from "./_components/PlatformCard";
import { FacebookModal } from "./_components/FacebookModal";
import { WhatsAppModal } from "./_components/WhatsAppModal";
import { StatsSummary } from "./_components/StatsSummary";

const FACEBOOK_LOGIN_SCOPE = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
].join(",");

const ICONS: any = { 
  facebook: MessengerIcon, 
  n8n_facebook: MessengerIcon, 
  instagram: InstagramIcon, 
  tiktok: TikTokIcon,
  whatsapp: WhatsAppIcon, 
  custom_api: Code2, 
  website: Globe, 
  webhook: Webhook, 
  telegram: TelegramIcon, 
  slack: SlackIcon 
};

export default function Integrations() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";
  const [items, setItems] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const { t } = useTranslation("chatbots");
  
  const [fbPages, setFbPages] = useState<any[]>([]);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeFbPlatform, setActiveFbPlatform] = useState<string>("n8n_facebook");

  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waForm, setWaForm] = useState({ accessToken: "", phoneNumberId: "", wabaId: "" });

  const load = async () => {
    if (!chatbotId) return;
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations`);
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);

      const usageRes = await fetch("/api/usage");
      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (e) {
      console.error("Failed to load integrations", e);
    }
  };

  useEffect(() => { load(); }, [chatbotId]);

  const isLocalDevelopmentHost = () => {
    const { hostname } = window.location;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  };

  const canUseFacebookSdk = () => {
    if (window.location.protocol === "https:") {
      return true;
    }

    return isLocalDevelopmentHost();
  };

  const toggle = async (it: any) => {
    if (it.coming_soon) { toast.info("Coming soon"); return; }

    if (it.connected) {
      await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/disconnect`, { method: "POST" });
      toast.success(`${it.name} disconnected successfully`);
      load();
      return;
    }

    if (it.platform === "facebook" || it.platform === "n8n_facebook") {
      setActiveFbPlatform(it.platform);
      handleFacebookConnect();
      return;
    }
    if (it.platform === "whatsapp") {
      setIsWaModalOpen(true);
      return;
    }

    await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/connect`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: {} })
    });
    toast.success(`${it.name} connected successfully`);
    load();
  };

  const handleFacebookConnect = () => {
    console.log("Attempting Facebook connect...");
    console.log("Current Protocol:", window.location.protocol);
    console.log("Current Hostname:", window.location.hostname);

    if (!facebookAppId) {
      toast.error("Facebook App ID is missing. Set NEXT_PUBLIC_FACEBOOK_APP_ID first.");
      console.error("NEXT_PUBLIC_FACEBOOK_APP_ID is not configured.");
      return;
    }

    if (!canUseFacebookSdk()) {
      toast.error("Facebook connection requires HTTPS. Use localhost for local development or open the app over HTTPS.");
      console.warn("Blocked Facebook login on an insecure non-local origin.");
      return;
    }

    // @ts-ignore
    if (!window.FB) { 
      toast.error(t("integration_errors.sdkLoadError")); 
      console.error("Facebook SDK (window.FB) is not defined.");
      return; 
    }

    if (window.location.protocol === "http:" && isLocalDevelopmentHost()) {
      console.warn("Facebook SDK is running over HTTP on localhost for development.");
    }

    // @ts-ignore
    window.FB.login((response: any) => {
      console.log("Facebook login response:", response);
      if (response.authResponse) {
        fetchPages(response.authResponse.accessToken);
      } else {
        toast.error("Facebook login failed or was cancelled");
      }
    }, { scope: FACEBOOK_LOGIN_SCOPE });
  };

  const fetchPages = async (token: string) => {
    setLoadingPages(true);
    setIsFbModalOpen(true);
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${token}&fields=name,id,access_token,category,picture`);
      const data = await res.json();
      setFbPages(data.data || []);
    } catch (e) {
      toast.error("Failed to fetch Facebook pages");
    } finally {
      setLoadingPages(false);
    }
  };

  const connectFacebookPage = async () => {
    const page = fbPages.find(p => p.id === selectedPageId);
    if (!page) return;

    setLoadingPages(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations/${activeFbPlatform}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pageId: page.id,
          pageToken: page.access_token,
          pageName: page.name,
        })
      });
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data?.error || "Failed to connect page");
      }

      toast.success(`Facebook Page "${page.name}" connected successfully`);
      setIsFbModalOpen(false);
      setSelectedPageId(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Failed to connect page");
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
    <div className="space-y-12 pb-10">
      <Script 
        src="https://connect.facebook.net/en_US/sdk.js" 
        strategy="lazyOnload"
        onLoad={() => {
          if (!facebookAppId) {
            console.error("Facebook SDK loaded but NEXT_PUBLIC_FACEBOOK_APP_ID is missing.");
            return;
          }

          // @ts-ignore
          if (window.FB) {
            // @ts-ignore
            window.FB.init({
              appId      : facebookAppId,
              cookie     : true,
              xfbml      : true,
              version    : 'v20.0'
            });
          }
        }}
      />
      
      <IntegrationHeader activeCount={activeCount} usage={usage} />

      <StatsSummary 
        activeCount={activeCount}
        availableCount={items.filter(i => !i.coming_soon).length}
        comingSoonCount={items.filter(i => i.coming_soon).length}
      />

      <div className="space-y-16">
        {/* AVAILABLE PLATFORMS */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-primary rounded-full" />
            <h2 className="text-xl font-bold tracking-tight">Available Platforms</h2>
          </div>
          <motion.div 
            initial="hidden" 
            animate="show" 
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} 
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {items.filter(i => !i.coming_soon).map((it) => (
              <PlatformCard 
                key={it.platform} 
                platform={it} 
                icon={ICONS[it.platform] || Plug} 
                onToggle={toggle} 
              />
            ))}
          </motion.div>
        </div>

        {/* COMING SOON PLATFORMS */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-muted rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-muted-foreground">Coming Soon</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.filter(i => i.coming_soon).map((it) => (
              <PlatformCard 
                key={it.platform} 
                platform={it} 
                icon={ICONS[it.platform] || Plug} 
                onToggle={toggle} 
              />
            ))}
          </div>
        </div>
      </div>

      <FacebookModal 
        open={isFbModalOpen} 
        onOpenChange={setIsFbModalOpen} 
        loadingPages={loadingPages} 
        fbPages={fbPages} 
        selectedPageId={selectedPageId} 
        onSelectPage={setSelectedPageId} 
        onConnect={connectFacebookPage} 
      />

      <WhatsAppModal 
        open={isWaModalOpen} 
        onOpenChange={setIsWaModalOpen} 
        loading={waLoading} 
        form={waForm} 
        onFormChange={setWaForm} 
        onConnect={connectWhatsApp} 
      />
    </div>
  );
}
