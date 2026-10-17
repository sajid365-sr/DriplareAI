"use client";

import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  BROADCAST_PLATFORMS,
  LEAD_STATUSES,
  type BroadcastAudience,
} from "./types";

/**
 * Who a broadcast reaches.
 *
 * Every filter is a list of chips rather than a multi-select dropdown, for the
 * same reason the condition editor uses them: the whole point of this control
 * is to be *readable at a glance*. "Which of my customers am I about to
 * message?" is not a question a collapsed dropdown answers.
 *
 * The audience is stored as a filter, not as a frozen list of recipients — so
 * editing it after scheduling legitimately changes who gets the message, and
 * the preview count has to be re-asked every time one of these changes.
 */
export function AudienceEditor({
  audience,
  tags,
  onChange,
}: {
  audience: BroadcastAudience;
  tags: { tagId: string; name: string }[];
  onChange: (audience: BroadcastAudience) => void;
}) {
  const { t } = useTranslation("automations");

  function toggle(key: "leadStatus" | "tags" | "platform", value: string) {
    const current = audience[key];
    onChange({
      ...audience,
      [key]: current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    });
  }

  return (
    <div className="space-y-4">
      <Group label={t("broadcasts.platform", "Channel")}>
        <div className="flex flex-wrap gap-1.5">
          {BROADCAST_PLATFORMS.map((platform) => (
            <Chip
              key={platform}
              selected={audience.platform.includes(platform)}
              onClick={() => toggle("platform", platform)}
            >
              {t(`templates.channel.${platform}`, platform)}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label={t("broadcasts.leadStatus", "Lead status")}>
        <div className="flex flex-wrap gap-1.5">
          {LEAD_STATUSES.map((status) => (
            <Chip
              key={status}
              selected={audience.leadStatus.includes(status)}
              onClick={() => toggle("leadStatus", status)}
            >
              {t(`broadcasts.leadStatusValues.${status}`, status)}
            </Chip>
          ))}
        </div>
      </Group>

      <Group label={t("broadcasts.tags", "Tags")}>
        {tags.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {t("broadcasts.noTags", "No tags yet — create them from a rule's “Add a tag” action.")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Chip
                key={tag.tagId}
                selected={audience.tags.includes(tag.tagId)}
                onClick={() => toggle("tags", tag.tagId)}
              >
                {tag.name}
              </Chip>
            ))}
          </div>
        )}
      </Group>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">{t("broadcasts.recency", "Last heard from")}</Label>
        <Select
          value={audience.lastSeenDays === null ? "any" : String(audience.lastSeenDays)}
          onValueChange={(value) =>
            onChange({ ...audience, lastSeenDays: value === "any" ? null : Number(value) })
          }
        >
          <SelectTrigger className="h-9 text-sm" data-testid="broadcast-recency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("broadcasts.recencyAny", "Any time")}</SelectItem>
            {[1, 3, 7, 14, 30, 90].map((days) => (
              <SelectItem key={days} value={String(days)}>
                {t("broadcasts.recencyDays", "In the last {{count}} days", { count: days })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {t(
            "broadcasts.recencyHint",
            "Anyone quieter than this is left out — messaging someone who has not written in months is what gets a WhatsApp number reported."
          )}
        </p>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        selected
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
