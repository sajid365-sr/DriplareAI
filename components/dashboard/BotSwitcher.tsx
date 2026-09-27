"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/core/utils";

interface BotSwitcherProps {
  /** chatbotId currently being viewed */
  currentBotId: string;
  /** current sub-path segment so we can mirror it on switch (e.g. "chat", "analytics") */
  subPath?: string;
}

interface BotEntry {
  chatbotId: string;
  name: string;
  status: string;
  avatarBase64?: string | null;
}

/**
 * Small avatar circle for a bot — gradient fallback when no custom avatar is set.
 */
function BotAvatar({ bot }: { bot: BotEntry }) {
  return (
    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
      {bot.avatarBase64 ? (
        <img src={bot.avatarBase64} alt={bot.name} className="w-full h-full object-cover" />
      ) : (
        bot.name?.[0]?.toUpperCase() || <Bot className="w-3 h-3" />
      )}
    </div>
  );
}

/**
 * Bot Switcher Dropdown — displayed in the header on all bot sub-pages.
 * Lists all workspace bots and navigates to the same sub-path on the selected bot.
 */
export function BotSwitcher({ currentBotId, subPath = "chat" }: BotSwitcherProps) {
  const router = useRouter();
  const [bots, setBots] = useState<BotEntry[]>([]);
  const [currentBot, setCurrentBot] = useState<BotEntry | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Fetch all bots for the active workspace
    fetch("/api/chatbots")
      .then((r) => r.json())
      .then((data: BotEntry[]) => {
        if (Array.isArray(data)) {
          setBots(data);
          const active = data.find((b) => b.chatbotId === currentBotId) ?? null;
          setCurrentBot(active);
        }
      })
      .catch(() => {/* silent fail — breadcrumb degrades gracefully */});
  }, [currentBotId]);

  const handleSelect = (bot: BotEntry) => {
    setOpen(false);
    if (bot.chatbotId !== currentBotId) {
      router.push(`/dashboard/chatbots/${bot.chatbotId}/${subPath}`);
    }
  };

  // While loading, render a slim skeleton pill
  if (!currentBot) {
    return (
      <div className="h-7 w-28 rounded-lg bg-muted/60 animate-pulse" />
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-border bg-background/60",
          "px-2 py-1 text-xs font-medium text-foreground",
          "hover:bg-muted/60 hover:border-border/80 transition-colors outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary/40",
          // Subtle status tint
          currentBot.status === "paused" && "border-amber-400/30"
        )}
        aria-label="Switch bot"
        data-testid="bot-switcher"
      >
        {/* Bot avatar */}
        <BotAvatar bot={currentBot} />

        {/* Bot name — truncated */}
        <span className="max-w-[130px] truncate leading-none">
          {currentBot.name}
        </span>

        {/* Status dot */}
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            currentBot.status === "paused" ? "bg-amber-400" : "bg-emerald-400"
          )}
        />

        <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-56 shadow-2xl"
        data-testid="bot-switcher-menu"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider px-2 py-1.5">
            Switch Bot
          </DropdownMenuLabel>
          {bots.map((bot) => {
            const isActive = bot.chatbotId === currentBotId;
            return (
              <DropdownMenuItem
                key={bot.chatbotId}
                onClick={() => handleSelect(bot)}
                className={cn(
                  "flex items-center gap-2 py-1.5 cursor-pointer",
                  isActive && "bg-primary/5"
                )}
                data-testid={`bot-option-${bot.chatbotId}`}
              >
                <BotAvatar bot={bot} />

                {/* Bot name */}
                <span className="flex-1 truncate text-sm">{bot.name}</span>

                {/* Status dot */}
                <span
                  className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    bot.status === "paused" ? "bg-amber-400" : "bg-emerald-400"
                  )}
                  title={bot.status === "paused" ? "Paused" : "Active"}
                />

                {/* Active checkmark */}
                {isActive && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {bots.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No bots found
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => { setOpen(false); router.push("/dashboard/chatbots"); }}
          className="text-xs text-muted-foreground gap-2 cursor-pointer"
        >
          <Bot className="w-3.5 h-3.5" />
          All Chatbots
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
