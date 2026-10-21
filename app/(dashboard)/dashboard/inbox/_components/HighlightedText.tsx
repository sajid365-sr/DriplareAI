"use client";

import { useMemo } from "react";

interface HighlightedTextProps {
  text: string;
  highlight: string;
  className?: string;
  highlightClassName?: string;
}

export const HighlightedText = ({
  text,
  highlight,
  className = "",
  highlightClassName = "bg-primary/20 text-primary font-bold px-0.5 rounded-xs",
}: HighlightedTextProps) => {
  const parts = useMemo(() => {
    if (!highlight || !highlight.trim()) return [text];
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    return text.split(regex);
  }, [text, highlight]);

  if (!highlight || !highlight.trim()) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

