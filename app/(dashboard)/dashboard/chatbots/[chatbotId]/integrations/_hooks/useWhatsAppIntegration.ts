import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { WhatsAppForm } from "../_components/WhatsAppModal";

export function useWhatsAppIntegration(
  chatbotId: string,
  metaAppId: string,
  whatsappConfigId: string,
  canUseFacebookSdk: () => boolean,
  loadIntegrations: () => void
) {
  const { t } = useTranslation("chatbots");
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
      loadIntegrations();
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
      loadIntegrations();
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

  return {
    isWaModalOpen,
    setIsWaModalOpen,
    waLoading,
    waForm,
    setWaForm,
    whatsappSignupSession,
    connectWhatsApp,
    startWhatsAppEmbeddedSignup
  };
}
