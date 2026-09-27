import {
    FacebookIcon,
    InstagramIcon,
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
 * Returns the appropriate icon component, color, and background class
 * for a given integration platform string.
 */
export function getPlatformIcon(platform: string): PlatformDetails {
    const p = platform.toLowerCase();
    if (p.includes("facebook") || p.includes("fb"))
        return { icon: FacebookIcon, color: "text-[#1877F2]", bg: "bg-[#1877F2]/10" };
    if (p.includes("instagram") || p.includes("ig"))
        return { icon: InstagramIcon, color: "text-[#E1306C]", bg: "bg-[#E1306C]/10" };
    if (p.includes("whatsapp"))
        return { icon: WhatsAppIcon, color: "text-[#25D366]", bg: "bg-[#25D366]/10" };
    return { icon: WebsiteWidgetIcon, color: "text-violet-500", bg: "bg-violet-500/10" };
}
