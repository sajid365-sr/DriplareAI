import { useMemo } from "react";
import { HighlightedText } from "./HighlightedText";
import { MessageSquareText } from "lucide-react";

export interface MessageSearchResultProps {
  matchedSnippet: string;
  searchQuery: string;
  matchCount?: number;
  matchRole?: string;
  className?: string;
}

export const MessageSearchResult = ({
  matchedSnippet,
  searchQuery,
  matchCount,
  matchRole,
  className = "",
}: MessageSearchResultProps) => {
  const roleLabel = useMemo(() => {
    if (matchRole === "user") return "Customer: ";
    if (matchRole === "assistant") return "AI Agent: ";
    return "";
  }, [matchRole]);

  return (
    <div
      className={`mt-1 flex items-start gap-1.5 p-1.5 rounded-md bg-muted/60 border border-primary/20 text-[11px] text-foreground/90 ${className}`}
    >
      <MessageSquareText className="w-3 h-3 text-primary shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 leading-snug">
        <span className="font-semibold text-muted-foreground">{roleLabel}</span>
        <HighlightedText
          text={matchedSnippet}
          highlight={searchQuery}
          className="text-foreground"
          highlightClassName="bg-primary/25 text-primary font-bold px-0.5 rounded-xs"
        />
        {matchCount && matchCount > 1 && (
          <span className="ml-1 text-[9.5px] font-medium text-primary">
            (+{matchCount - 1} more)
          </span>
        )}
      </div>
    </div>
  );
};
