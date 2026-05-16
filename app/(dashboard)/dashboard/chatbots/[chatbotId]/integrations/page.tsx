"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Code2, Globe, Webhook, Plug } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

import { WhatsAppIcon, InstagramIcon, MessengerIcon, TikTokIcon, SlackIcon, TelegramIcon } from "@/components/icons/PlatformIcons";
import { IntegrationHeader } from "./_components/IntegrationHeader";
import { PlatformCard, type PlatformIntegration } from "./_components/PlatformCard";
import { FacebookModal } from "./_components/FacebookModal";
import { PlatformDetailsModal } from "./_components/PlatformDetailsModal";
import { WhatsAppModal } from "./_components/WhatsAppModal";
import { StatsSummary } from "./_components/StatsSummary";

type FacebookLoginResponse = {
  authResponse?: {
    accessToken: string;
  };
};

type FacebookSdk = {
  login: (callback: (response: FacebookLoginResponse) => void, options: { scope: string }) => void;
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
};

type FacebookPage = {
  id: string;
  name: string;
  category?: string | null;
  pictureUrl?: string | null;
};

type UsageSummary = {
  maxIntegrationsPerChatbot?: number;
  integrationsLimit?: number;
  integrationsUsed?: number;
  [key: string]: unknown;
};

type WhatsAppForm = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

const FACEBOOK_LOGIN_SCOPE = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
].join(",");

const ICONS: Record<string, ComponentType<{ className?: string }>> = { 
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
  const [items, setItems] = useState<PlatformIntegration[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const { t } = useTranslation("chatbots");
  
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [facebookUserToken, setFacebookUserToken] = useState<string | null>(null);
  const [activeFbPlatform, setActiveFbPlatform] = useState<string>("facebook");
  const [detailsPlatform, setDetailsPlatform] = useState<PlatformIntegration | null>(null);

  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waForm, setWaForm] = useState<WhatsAppForm>({ accessToken: "", phoneNumberId: "", wabaId: "" });

  const load = useCallback(async () => {
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
  }, [chatbotId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

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

  const toggle = async (it: PlatformIntegration) => {
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

  const reconnectPlatform = (it: PlatformIntegration) => {
    if (it.platform === "facebook" || it.platform === "n8n_facebook") {
      setDetailsPlatform(null);
      setActiveFbPlatform(it.platform);
      handleFacebookConnect();
      return;
    }

    setDetailsPlatform(null);
    toggle({ ...it, connected: false });
  };

  const disconnectPlatform = async (it: PlatformIntegration) => {
    setDetailsPlatform(null);
    await fetch(`/api/chatbots/${chatbotId}/integrations/${it.platform}/disconnect`, { method: "POST" });
    toast.success(`${it.name} disconnected successfully`);
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

    if (!window.FB) { 
      toast.error(t("integration_errors.sdkLoadError")); 
      console.error("Facebook SDK (window.FB) is not defined.");
      return; 
    }

    if (window.location.protocol === "http:" && isLocalDevelopmentHost()) {
      console.warn("Facebook SDK is running over HTTP on localhost for development.");
    }

    window.FB.login((response) => {
      console.log("Facebook login response:", response);
      if (response.authResponse) {
        setFacebookUserToken(response.authResponse.accessToken);
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
      const res = await fetch(`/api/chatbots/${chatbotId}/integrations/facebook/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: token }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch Facebook pages");
      }

      setFbPages(data.pages || []);
    } catch (e) {
      setFbPages([]);
      setFacebookUserToken(null);
      toast.error(e instanceof Error ? e.message : "Failed to fetch Facebook pages");
    } finally {
      setLoadingPages(false);
    }
  };

  const connectFacebookPage = async () => {
    const page = fbPages.find((p) => p.id === selectedPageId);
    if (!page || !facebookUserToken) {
      toast.error("Facebook login session was not found. Please reconnect the page.");
      return;
    }

    setLoadingPages(true);
    try {
      const r = await fetch(`/api/chatbots/${chatbotId}/integrations/${activeFbPlatform}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pageId: page.id,
          userToken: facebookUserToken,
        })
      });
      const data = await r.json();

      if (!r.ok) {
        throw new Error(data?.error || "Failed to connect page");
      }

      toast.success(`Facebook Page "${page.name}" connected successfully`);
      setIsFbModalOpen(false);
      setSelectedPageId(null);
      setFacebookUserToken(null);
      setFbPages([]);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect page");
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect WhatsApp");
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

          if (window.FB) {
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
            <h2 className="text-xl font-bold tracking-tight">{t("integrations_page.availablePlatforms")}</h2>
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
                onShowDetails={setDetailsPlatform}
              />
            ))}
          </motion.div>
        </div>

        {/* COMING SOON PLATFORMS */}
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-muted rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-muted-foreground">
              {t("integrations_page.comingSoon")}
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.filter(i => i.coming_soon).map((it) => (
              <PlatformCard 
                key={it.platform} 
                platform={it} 
                icon={ICONS[it.platform] || Plug} 
                onToggle={toggle} 
                onShowDetails={setDetailsPlatform}
              />
            ))}
          </div>
        </div>
      </div>

      <FacebookModal 
        open={isFbModalOpen} 
        onOpenChange={(open) => {
          setIsFbModalOpen(open);
          if (!open) {
            setSelectedPageId(null);
            setFacebookUserToken(null);
            setFbPages([]);
          }
        }} 
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

      <PlatformDetailsModal
        open={Boolean(detailsPlatform)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailsPlatform(null);
          }
        }}
        platform={detailsPlatform}
        onReconnect={reconnectPlatform}
        onDisconnect={disconnectPlatform}
      />
    </div>
  );
}
