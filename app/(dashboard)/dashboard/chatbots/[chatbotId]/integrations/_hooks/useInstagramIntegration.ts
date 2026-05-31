import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { InstagramAccount } from "../_components/InstagramModal";

const INSTAGRAM_LOGIN_SCOPE = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

export function useInstagramIntegration(chatbotId: string, facebookAppId: string, canUseFacebookSdk: () => boolean, loadIntegrations: () => void) {
  const { t } = useTranslation("chatbots");
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [instagramPagesWithoutIg, setInstagramPagesWithoutIg] = useState<{ pageId: string; pageName: string }[]>([]);
  const [instagramManagedPageCount, setInstagramManagedPageCount] = useState(0);
  const [selectedInstagramAccountId, setSelectedInstagramAccountId] = useState<string | null>(null);
  const [instagramUserToken, setInstagramUserToken] = useState<string | null>(null);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [loadingInstagramAccounts, setLoadingInstagramAccounts] = useState(false);

  const handleInstagramConnect = () => {
    setSelectedInstagramAccountId(null);
    setInstagramUserToken(null);
    setInstagramAccounts([]);
    setInstagramPagesWithoutIg([]);
    setInstagramManagedPageCount(0);
    setIsInstagramModalOpen(true);
  };

  const handleInstagramOAuthConnect = () => {
    window.location.href = `/api/chatbots/${chatbotId}/integrations/instagram/oauth/start`;
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

  const handleInstagramFacebookConnect = () => {
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
      loadIntegrations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Instagram");
    } finally {
      setLoadingInstagramAccounts(false);
    }
  };

  return {
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
  };
}
