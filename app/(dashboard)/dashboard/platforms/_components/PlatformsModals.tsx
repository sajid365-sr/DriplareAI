"use client";

import {
    ConfigureChannelModal,
    type ChannelItem,
    type ChatbotOption,
} from "@/components/integrations/ConfigureChannelModal";
import { FacebookModal } from "@/components/integrations/FacebookModal";
import {
    InstagramModal,
    type InstagramAccount,
} from "@/components/integrations/InstagramModal";
import {
    WhatsAppModal,
    type WhatsAppForm,
} from "@/components/integrations/WhatsAppModal";

// ── Configure Channel Modal props ──────────────────────────────────────────────
interface ConfigureModalProps {
    isOpen: boolean;
    onClose: () => void;
    channel: ChannelItem | null;
    chatbots: ChatbotOption[];
    onUpdateChannel: (updated: ChannelItem) => void;
}

// ── Facebook Modal props ──────────────────────────────────────────────────────
interface FacebookModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    loadingPages: boolean;
    fbPages: Array<{ id: string; name: string }>;
    selectedPageId: string | null;
    onSelectPage: (id: string | null) => void;
    onConnect: () => void;
}

// ── WhatsApp Modal props ──────────────────────────────────────────────────────
interface WhatsAppModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    loading: boolean;
    embeddedAvailable: boolean;
    form: WhatsAppForm;
    onFormChange: (form: WhatsAppForm) => void;
    onEmbeddedConnect: () => void;
    onManualConnect: () => void;
}

// ── Instagram Modal props ─────────────────────────────────────────────────────
interface InstagramModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    loadingAccounts: boolean;
    accounts: InstagramAccount[];
    pagesWithoutInstagram?: { pageId: string; pageName: string }[];
    managedPageCount?: number;
    selectedAccountId: string | null;
    onSelectAccount: (id: string) => void;
    onConnect: () => void;
    onInstagramLoginConnect?: () => void;
    onFacebookConnect?: () => void;
}

// ── Combined props ────────────────────────────────────────────────────────────
interface PlatformsModalsProps {
    configure: ConfigureModalProps;
    facebook: FacebookModalProps;
    whatsapp: WhatsAppModalProps;
    instagram: InstagramModalProps;
}

/**
 * Renders all integration-related modals in one place.
 * Keeps the parent page clean by grouping modal state and rendering here.
 */
export function PlatformsModals({
    configure,
    facebook,
    whatsapp,
    instagram,
}: PlatformsModalsProps) {
    return (
        <>
            {/* Configure Channel Modal */}
            <ConfigureChannelModal
                isOpen={configure.isOpen}
                onClose={configure.onClose}
                channel={configure.channel}
                chatbots={configure.chatbots}
                onUpdateChannel={configure.onUpdateChannel}
            />

            {/* Facebook Connect Modal */}
            <FacebookModal
                open={facebook.open}
                onOpenChange={facebook.onOpenChange}
                loadingPages={facebook.loadingPages}
                fbPages={facebook.fbPages}
                selectedPageId={facebook.selectedPageId}
                onSelectPage={facebook.onSelectPage}
                onConnect={facebook.onConnect}
            />

            {/* WhatsApp Connect Modal */}
            <WhatsAppModal
                open={whatsapp.open}
                onOpenChange={whatsapp.onOpenChange}
                loading={whatsapp.loading}
                embeddedAvailable={whatsapp.embeddedAvailable}
                form={whatsapp.form}
                onFormChange={whatsapp.onFormChange}
                onEmbeddedConnect={whatsapp.onEmbeddedConnect}
                onManualConnect={whatsapp.onManualConnect}
            />

            {/* Instagram Connect Modal */}
            <InstagramModal
                open={instagram.open}
                onOpenChange={instagram.onOpenChange}
                loadingAccounts={instagram.loadingAccounts}
                accounts={instagram.accounts}
                pagesWithoutInstagram={instagram.pagesWithoutInstagram}
                managedPageCount={instagram.managedPageCount}
                selectedAccountId={instagram.selectedAccountId}
                onSelectAccount={instagram.onSelectAccount}
                onConnect={instagram.onConnect}
                onInstagramLoginConnect={instagram.onInstagramLoginConnect}
                onFacebookConnect={instagram.onFacebookConnect}
            />
        </>
    );
}
