import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { exchangeMetaBusinessLoginCode } from "./meta-business-login";

export type FacebookPage = {
  id: string;
  name: string;
  category?: string | null;
  pictureUrl?: string | null;
};

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

export function useFacebookIntegration(
  chatbotId: string,
  businessLoginConfigId: string,
  loadIntegrations: () => void
) {
  const { t } = useTranslation("chatbots");
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [facebookUserToken, setFacebookUserToken] = useState<string | null>(null);
  const [activeFbPlatform, setActiveFbPlatform] = useState<string>("facebook");

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

  const handleFacebookConnect = (platform: string = "facebook") => {
    setActiveFbPlatform(platform);

    if (!businessLoginConfigId) {
      toast.error("Facebook Login for Business is not configured for this Meta app.");
      return;
    }

    if (!canUseFacebookSdk()) {
      toast.error("Facebook connection requires HTTPS. Use localhost for local development or open the app over HTTPS.");
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
        toast.error("Facebook login failed or was cancelled");
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
          setFacebookUserToken(userToken);
          await fetchPages(userToken);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Facebook login failed");
        }
      })();
    }, {
      config_id: businessLoginConfigId,
      response_type: "code",
      override_default_response_type: true,
    });
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
      loadIntegrations();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to connect page");
    } finally {
      setLoadingPages(false);
    }
  };

  return {
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
  };
}
