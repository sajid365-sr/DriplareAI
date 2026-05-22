"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Code2, Globe, Webhook, Plug, Search } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

import { WhatsAppIcon, InstagramIcon, MessengerIcon, TikTokIcon, SlackIcon, TelegramIcon } from "@/components/icons/PlatformIcons";
import { IntegrationHeader } from "./_components/IntegrationHeader";
import { PlatformCard, type PlatformIntegration } from "./_components/PlatformCard";
import { FacebookModal } from "./_components/FacebookModal";
import { PlatformDetailsModal } from "./_components/PlatformDetailsModal";
import { WhatsAppModal, type WhatsAppForm } from "./_components/WhatsAppModal";
import { InstagramModal, type InstagramAccount } from "./_components/InstagramModal";
import { StatsSummary } from "./_components/StatsSummary";

type FacebookLoginResponse = {
  authResponse?: {
    accessToken: string;
    code?: string;
  };
};

type FacebookSdk = {
  login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void;
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

const INSTAGRAM_LOGIN_SCOPE = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
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
  const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "";
  const facebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || metaAppId;
  const whatsappConfigId = process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID || "";
  const [items, setItems] = useState<PlatformIntegration[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [platformSearch, setPlatformSearch] = useState("");
  const { t } = useTranslation("chatbots");
  
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [facebookUserToken, setFacebookUserToken] = useState<string | null>(null);
  const [activeFbPlatform, setActiveFbPlatform] = useState<string>("facebook");
  const [detailsPlatform, setDetailsPlatform] = useState<PlatformIntegration | null>(null);
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [instagramPagesWithoutIg, setInstagramPagesWithoutIg] = useState<{ pageId: string; pageName: string }[]>([]);
  const [instagramManagedPageCount, setInstagramManagedPageCount] = useState(0);
  const [selectedInstagramAccountId, setSelectedInstagramAccountId] = useState<string | null>(null);
  const [instagramUserToken, setInstagramUserToken] = useState<string | null>(null);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [loadingInstagramAccounts, setLoadingInstagramAccounts] = useState(false);

  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waForm, setWaForm] = useState<WhatsAppForm>({ accessToken: "", phoneNumberId: "", wabaId: "" });
  const [whatsappSignupSession, setWhatsappSignupSession] = useState<{
    phoneNumberId?: string;
    wabaId?: string;
  }>({});
  const whatsappSignupSessionRef = useRef<{
    phoneNumberId?: string;
    wabaId?: string;
  }>({});

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

  useEffect(() => {
    const handleWhatsAppSignupMessage = (event: MessageEvent<string>) => {
      if (!event.origin.endsWith("facebook.com")) {
        return;
      }

      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          event?: string;
          data?: {
            phone_number_id?: string;
            waba_id?: string;
          };
        };

        if (data.type !== "WA_EMBEDDED_SIGNUP") {
          return;
        }

        const session = {
          phoneNumberId: data.data?.phone_number_id,
          wabaId: data.data?.waba_id,
        };

        whatsappSignupSessionRef.current = session;
        setWhatsappSignupSession(session);
      } catch {
        // Meta also sends non-JSON postMessage events. Ignore those quietly.
      }
    };

    window.addEventListener("message", handleWhatsAppSignupMessage);
    return () => window.removeEventListener("message", handleWhatsAppSignupMessage);
  }, []);

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
    if (it.platform === "instagram") {
      handleInstagramConnect();
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

    if (it.platform === "whatsapp") {
      setDetailsPlatform(null);
      setIsWaModalOpen(true);
      return;
    }

    if (it.platform === "instagram") {
      setDetailsPlatform(null);
      handleInstagramConnect();
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

  const handleInstagramConnect = () => {
    if (!facebookAppId) {
      toast.error("Meta App ID is missing. Set NEXT_PUBLIC_META_APP_ID first.");
      return;
    }

    if (!canUseFacebookSdk()) {
      toast.error(t("integration_errors.httpsRequired"));
      return;
    }

    if (!window.FB) {
      toast.error(t("integration_errors.sdkLoadError"));
      return;
    }

    window.FB.login((response) => {
      if (response.authResponse?.accessToken) {
        setInstagramUserToken(response.authResponse.accessToken);
        fetchInstagramAccounts(response.authResponse.accessToken);
      } else {
        toast.error(t("instagram_modal.loginFailed"));
      }
    }, { scope: INSTAGRAM_LOGIN_SCOPE });
  };

  const fetchInstagramAccounts = async (token: string) => {
    setLoadingInstagramAccounts(true);
    setIsInstagramModalOpen(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/integrations/instagram/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userToken: token }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch Instagram accounts");
      }

      setInstagramAccounts(data.accounts || []);
      setInstagramPagesWithoutIg(data.pagesWithoutInstagram || []);
      setInstagramManagedPageCount(typeof data.managedPageCount === "number" ? data.managedPageCount : 0);

      if ((data.accounts || []).length === 0) {
        const pagesWithout = data.pagesWithoutInstagram?.length ?? 0;
        const managed = data.managedPageCount ?? 0;
        if (managed === 0) {
          toast.error(
            "No Facebook Pages found for this login. Use a Facebook account that manages your business Page."
          );
        } else if (pagesWithout > 0) {
          toast.error(
            `${pagesWithout} Page(s) found but Instagram is not linked. Link a Professional Instagram account to the Page in Meta Business Settings, then try again.`
          );
        }
      }
    } catch (error) {
      setInstagramAccounts([]);
      setInstagramPagesWithoutIg([]);
      setInstagramManagedPageCount(0);
      setInstagramUserToken(null);
      toast.error(error instanceof Error ? error.message : "Failed to fetch Instagram accounts");
    } finally {
      setLoadingInstagramAccounts(false);
    }
  };

  const connectInstagramAccount = async () => {
    const account = instagramAccounts.find((item) => item.id === selectedInstagramAccountId);

    if (!account || !instagramUserToken) {
      toast.error(t("instagram_modal.missingSession"));
      return;
    }

    setLoadingInstagramAccounts(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/integrations/instagram/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          userToken: instagramUserToken,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to connect Instagram");
      }

      toast.success(t("instagram_modal.connectedSuccess"));
      setIsInstagramModalOpen(false);
      setSelectedInstagramAccountId(null);
      setInstagramUserToken(null);
      setInstagramAccounts([]);
      setInstagramPagesWithoutIg([]);
      setInstagramManagedPageCount(0);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Instagram");
    } finally {
      setLoadingInstagramAccounts(false);
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
    if (!waForm.accessToken || !waForm.phoneNumberId) {
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

  const connectWhatsAppEmbedded = async (code: string) => {
    const phoneNumberId = whatsappSignupSessionRef.current.phoneNumberId || whatsappSignupSession.phoneNumberId;
    const wabaId = whatsappSignupSessionRef.current.wabaId || whatsappSignupSession.wabaId;

    if (!phoneNumberId) {
      toast.error(t("whatsapp_modal.missingEmbeddedPhone"));
      return;
    }

    setWaLoading(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/integrations/whatsapp/embedded/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          phoneNumberId,
          wabaId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to connect WhatsApp");
      }

      toast.success(t("whatsapp_modal.connectedSuccess"));
      setIsWaModalOpen(false);
      whatsappSignupSessionRef.current = {};
      setWhatsappSignupSession({});
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect WhatsApp");
    } finally {
      setWaLoading(false);
    }
  };

  const startWhatsAppEmbeddedSignup = () => {
    if (!metaAppId || !whatsappConfigId) {
      toast.error(t("whatsapp_modal.embeddedUnavailable"));
      return;
    }

    if (!canUseFacebookSdk()) {
      toast.error(t("integration_errors.httpsRequired"));
      return;
    }

    if (!window.FB) {
      toast.error(t("integration_errors.sdkLoadError"));
      return;
    }

    setWhatsappSignupSession({});
    whatsappSignupSessionRef.current = {};
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;

        if (!code) {
          toast.error(t("whatsapp_modal.signupCancelled"));
          return;
        }

        connectWhatsAppEmbedded(code);
      },
      {
        config_id: whatsappConfigId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          sessionInfoVersion: 3,
        },
      }
    );
  };

  const activeCount = items.filter(i => i.connected).length;
  const normalizedSearch = platformSearch.trim().toLowerCase();
  const searchedItems = normalizedSearch
    ? items.filter((item) => {
        const translatedName = t(`integration_platforms.${item.platform}.name`, { defaultValue: item.name });
        return (
          item.name.toLowerCase().includes(normalizedSearch) ||
          item.platform.toLowerCase().includes(normalizedSearch) ||
          translatedName.toLowerCase().includes(normalizedSearch)
        );
      })
    : items;
  const availablePlatforms = searchedItems.filter((item) => !item.coming_soon);
  const comingSoonPlatforms = searchedItems.filter((item) => item.coming_soon);

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
              appId      : metaAppId || facebookAppId,
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 bg-primary rounded-full" />
              <h2 className="text-xl font-bold tracking-tight">{t("integrations_page.availablePlatforms")}</h2>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={platformSearch}
                onChange={(event) => setPlatformSearch(event.target.value)}
                placeholder={t("integrations_page.searchPlaceholder")}
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <motion.div 
            initial="hidden" 
            animate="show" 
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} 
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {availablePlatforms.map((it) => (
              <PlatformCard 
                key={it.platform} 
                platform={it} 
                icon={ICONS[it.platform] || Plug} 
                onToggle={toggle} 
                onShowDetails={setDetailsPlatform}
              />
            ))}
          </motion.div>
          {availablePlatforms.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              {t("integrations_page.noPlatformsFound")}
            </div>
          ) : null}
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
            {comingSoonPlatforms.map((it) => (
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
        embeddedAvailable={Boolean(metaAppId && whatsappConfigId)}
        form={waForm} 
        onFormChange={setWaForm} 
        onEmbeddedConnect={startWhatsAppEmbeddedSignup}
        onManualConnect={connectWhatsApp}
      />

      <InstagramModal
        open={isInstagramModalOpen}
        onOpenChange={(open) => {
          setIsInstagramModalOpen(open);
          if (!open) {
            setSelectedInstagramAccountId(null);
            setInstagramUserToken(null);
            setInstagramAccounts([]);
            setInstagramPagesWithoutIg([]);
            setInstagramManagedPageCount(0);
          }
        }}
        loadingAccounts={loadingInstagramAccounts}
        accounts={instagramAccounts}
        pagesWithoutInstagram={instagramPagesWithoutIg}
        managedPageCount={instagramManagedPageCount}
        selectedAccountId={selectedInstagramAccountId}
        onSelectAccount={setSelectedInstagramAccountId}
        onConnect={connectInstagramAccount}
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
