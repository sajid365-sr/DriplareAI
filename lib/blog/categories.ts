/** Blog categories aligned with live admin portal */
export const BLOG_CATEGORIES = [
  "General",
  "Automation",
  "Security",
  "Workflow Automation",
  "AI Agent",
  "Product Updates",
  "Tutorials",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

/** Category badge styles — theme-aware tints */
export function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case "Automation":
      return "bg-info/15 text-info border-info/25";
    case "Security":
      return "bg-primary/10 text-primary border-primary/20";
    case "Workflow Automation":
      return "bg-info/20 text-info border-info/30";
    case "AI Agent":
      return "bg-primary/15 text-primary border-primary/25";
    case "Product Updates":
      return "bg-success/15 text-success border-success/25";
    case "Tutorials":
      return "bg-warning/15 text-warning border-warning/25";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "published":
      return "bg-success/15 text-success border-success/30";
    case "archived":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-warning/15 text-warning border-warning/30";
  }
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function formatTagsInput(tags: string[] | null | undefined): string {
  return (tags ?? []).join(", ");
}

/** Render tags with overflow count like live portal (+N) */
export function visibleTags(tags: string[] | null | undefined, max = 2) {
  const safe = tags ?? [];
  const shown = safe.slice(0, max);
  const hidden = Math.max(0, safe.length - max);
  return { shown, hidden };
}
