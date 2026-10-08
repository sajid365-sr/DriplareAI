import {
  Activity,
  BadgeCheck,
  Bell,
  Bot,
  BotOff,
  CheckCheck,
  Clock,
  FileText,
  Hand,
  Heart,
  Image as ImageIcon,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  MoonStar,
  PackageCheck,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  // TagOff,
  Tags,
  TriangleAlert,
  Truck,
  UserCheck,
  UserRound,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The catalog and the presets name their icons as strings so they can stay
 * plain data — importing a React component into them would drag the whole of
 * lucide into a module the server bundle also reads.
 *
 * `Zap` is the fallback rather than an error: an icon name that a future
 * catalog entry spells wrong should cost a wrong picture, not a blank card.
 */
const ICONS: Record<string, LucideIcon> = {
  Activity,
  BadgeCheck,
  Bell,
  Bot,
  BotOff,
  CheckCheck,
  Clock,
  FileText,
  Hand,
  Heart,
  Image: ImageIcon,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquare,
  MoonStar,
  PackageCheck,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  // TagOff,
  Tags,
  TriangleAlert,
  Truck,
  UserCheck,
  UserRound,
  Webhook,
  Zap,
};

export function iconFor(name: string | undefined): LucideIcon {
  return (name && ICONS[name]) || Zap;
}
