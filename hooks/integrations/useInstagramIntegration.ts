import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { InstagramAccount } from "@/components/integrations/InstagramModal";
import { exchangeMetaBusinessLoginCode } from "./meta-business-login";

export function useInstagramIntegration(
  chatbotId: string,
  businessLoginConfigId: string,
  canUseFacebookSdk: () => boolean,
  loadIntegrations: () => void
) {
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
    if (!chatbotId) return;
    window.location.href = `/api/chatbots/${encodeURIComponent(chatbotId)}/integrations/instagram/oauth/start`;
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
          toast.error("No Facebook Pages found for this login. Use a Facebook account that manages your business Page.");
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
    if (!businessLoginConfigId) {
      toast.error("Facebook Login for Business is not configured for Instagram.");
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
      const code = response.authResponse?.code;
      const accessToken = response.authResponse?.accessToken;
      if (!code && !accessToken) {
        toast.error(t("instagram_modal.loginFailed"));
        return;
      }

      void (async () => {
        try {
          const userToken = code
            ? await exchangeMetaBusinessLoginCode(chatbotId, code)
            : accessToken;
          if (!userToken) {
            throw new Error("Meta did not return an access token.");
          }
          setInstagramUserToken(userToken);
          await fetchInstagramAccounts(userToken);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Facebook Login for Business failed");
        }
      })();
    }, {
      config_id: businessLoginConfigId,
      response_type: "code",
      override_default_response_type: true,
    });
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
    connectInstagramAccount,
  };
}
