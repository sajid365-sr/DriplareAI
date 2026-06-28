"use client";

import type { ComponentType } from "react";
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
import { WhatsAppModal } from "./_components/WhatsAppModal";
import { InstagramModal } from "./_components/InstagramModal";
import { WebsiteWidgetModal } from "./_components/WebsiteWidgetModal";
import { StatsSummary } from "./_components/StatsSummary";

import { useIntegrationsData } from "./_hooks/useIntegrationsData";
import { useFacebookIntegration } from "./_hooks/useFacebookIntegration";
import { useInstagramIntegration } from "./_hooks/useInstagramIntegration";
import { useWhatsAppIntegration } from "./_hooks/useWhatsAppIntegration";
import { useWebsiteIntegration } from "./_hooks/useWebsiteIntegration";

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

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

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
  const { t } = useTranslation("chatbots");

  // Data hook
  const {
    items,
    usage,
    platformSearch,
    setPlatformSearch,
    detailsPlatform,
    setDetailsPlatform,
    load,
    disconnectPlatform,
    connectGenericPlatform
  } = useIntegrationsData(chatbotId);

  // Facebook hook
  const {
    fbPages,
    isFbModalOpen,
    setIsFbModalOpen,
    loadingPages,
    selectedPageId,
    setSelectedPageId,
    handleFacebookConnect,
    connectFacebookPage,
    setActiveFbPlatform,
    canUseFacebookSdk
  } = useFacebookIntegration(chatbotId, facebookAppId, load);

  // Instagram hook
  const {
    instagramAccounts,
    instagramPagesWithoutIg,
    instagramManagedPageCount,
    selectedInstagramAccountId,
    setSelectedInstagramAccountId,
    isInstagramModalOpen,
    setIsInstagramModalOpen,
    loadingInstagramAccounts,
    handleInstagramConnect,
    handleInstagramOAuthConnect,
    handleInstagramFacebookConnect,
    connectInstagramAccount
  } = useInstagramIntegration(chatbotId, facebookAppId, canUseFacebookSdk, load);

  // WhatsApp hook
  const {
    isWaModalOpen,
    setIsWaModalOpen,
    waLoading,
    waForm,
    setWaForm,
    connectWhatsApp,
    startWhatsAppEmbeddedSignup
  } = useWhatsAppIntegration(chatbotId, metaAppId, whatsappConfigId, canUseFacebookSdk, load);

  // Website widget hook
  const {
    isModalOpen: isWebsiteModalOpen,
    setIsModalOpen: setIsWebsiteModalOpen,
    embedCode,
    connecting: websiteConnecting,
    handleConnect: handleWebsiteConnect,
    refreshEmbedCode,
    copyToClipboard: copyWebsiteCode,
  } = useWebsiteIntegration(chatbotId, load, connectGenericPlatform);

  const toggle = async (it: PlatformIntegration) => {
    if (it.coming_soon) { toast.info("Coming soon"); return; }

    if (it.connected) {
      await disconnectPlatform(it);
      return;
    }

    if (it.platform === "facebook" || it.platform === "n8n_facebook") {
      setActiveFbPlatform(it.platform);
      handleFacebookConnect(it.platform);
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
    if (it.platform === "website") {
      await handleWebsiteConnect();
      return;
    }

    await connectGenericPlatform(it);
  };

  const reconnectPlatform = (it: PlatformIntegration) => {
    if (it.platform === "facebook" || it.platform === "n8n_facebook") {
      setDetailsPlatform(null);
      setActiveFbPlatform(it.platform);
      handleFacebookConnect(it.platform);
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
    if (it.platform === "website") {
      setDetailsPlatform(null);
      handleWebsiteConnect();
      return;
    }

    setDetailsPlatform(null);
    toggle({ ...it, connected: false });
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
            // setFacebookUserToken is handled within the hook if needed, but the modal close mostly just resets IDs.
            // Actually, in the hook we should have a reset function if needed, but for now just setting selected to null is fine.
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
          }
        }}
        loadingAccounts={loadingInstagramAccounts}
        accounts={instagramAccounts}
        pagesWithoutInstagram={instagramPagesWithoutIg}
        managedPageCount={instagramManagedPageCount}
        selectedAccountId={selectedInstagramAccountId}
        onSelectAccount={setSelectedInstagramAccountId}
        onConnect={connectInstagramAccount}
        onInstagramLoginConnect={handleInstagramOAuthConnect}
        onFacebookConnect={handleInstagramFacebookConnect}
      />

      <WebsiteWidgetModal
        open={isWebsiteModalOpen}
        onOpenChange={setIsWebsiteModalOpen}
        embedCode={embedCode}
        connecting={websiteConnecting}
        onCopy={copyWebsiteCode}
        onRefresh={refreshEmbedCode}
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
