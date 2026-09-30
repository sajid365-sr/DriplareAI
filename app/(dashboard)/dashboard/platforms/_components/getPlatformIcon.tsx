import { Webhook, Code2 } from "lucide-react";
import {
    FacebookIcon,
    InstagramIcon,
    MessengerIcon,
    SlackIcon,
    TelegramIcon,
    TikTokIcon,
    WhatsAppIcon,
    WebsiteWidgetIcon,
} from "@/components/icons/PlatformIcons";
import type { ComponentType } from "react";

interface PlatformDetails {
    icon: ComponentType<{ className?: string }>;
    color: string;
    bg: string;
}

/**
 * Exact platform ids, checked before the fuzzy matching below.
 *
 * `platformId` is free text an admin types in `/admin/platforms`, so the fuzzy
 * pass is what catches whatever they invent (`n8n_facebook`, `my_crm`, …). These
 * known ids come first so a name that merely *contains* another platform's
 * letters cannot steal its icon — "tiktok" and "telegram" both used to fall
 * through to the website icon.
 */
const KNOWN_PLATFORMS: Record<string, PlatformDetails> = {
    facebook: {
        icon: FacebookIcon,
        color: "text-[#1877F2]",
        bg: "bg-[#1877F2]/10",
    },
    messenger: {
        icon: MessengerIcon,
        color: "text-[#0084FF]",
        bg: "bg-[#0084FF]/10",
    },
    instagram: {
        icon: InstagramIcon,
        color: "text-[#E1306C]",
        bg: "bg-[#E1306C]/10",
    },
    whatsapp: {
        icon: WhatsAppIcon,
        color: "text-[#25D366]",
        bg: "bg-[#25D366]/10",
    },
    telegram: {
        icon: TelegramIcon,
        color: "text-[#229ED9]",
        bg: "bg-[#229ED9]/10",
    },
    slack: {
        icon: SlackIcon,
        color: "text-[#611F69]",
        bg: "bg-[#611F69]/10",
    },
    tiktok: {
        icon: TikTokIcon,
        color: "text-foreground",
        bg: "bg-foreground/10",
    },
    website: { icon: WebsiteWidgetIcon, color: "text-primary", bg: "bg-primary/10" },
};

/** Platforms whose id describes what they are rather than which vendor they are. */
const GENERIC_PLATFORMS: Record<string, PlatformDetails> = {
    webhook: {
        icon: Webhook,
        color: "text-primary",
        bg: "bg-primary/10",
    },
    custom_api: {
        icon: Code2,
        color: "text-primary",
        bg: "bg-primary/10",
    },
};

/**
 * Returns the appropriate icon component, color, and background class
 * for a given integration platform string.
 */
export function getPlatformIcon(platform: string): PlatformDetails {
    const p = platform.toLowerCase();

    const known = KNOWN_PLATFORMS[p] ?? GENERIC_PLATFORMS[p];
    if (known) return known;

    if (p.includes("facebook") || p.includes("fb") || p.includes("messenger"))
        return KNOWN_PLATFORMS.facebook;
    if (p.includes("instagram") || p.includes("ig")) return KNOWN_PLATFORMS.instagram;
    if (p.includes("whatsapp")) return KNOWN_PLATFORMS.whatsapp;
    if (p.includes("telegram")) return KNOWN_PLATFORMS.telegram;
    if (p.includes("slack")) return KNOWN_PLATFORMS.slack;
    if (p.includes("tiktok")) return KNOWN_PLATFORMS.tiktok;

    // An id nobody has taught this function about: the widget icon is the honest
    // default, since a website widget is the only channel with no vendor behind it.
    return KNOWN_PLATFORMS.website;
}
