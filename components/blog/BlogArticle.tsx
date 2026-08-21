import { cn } from "@/lib/utils";

type BlogArticleProps = {
  html: string;
  className?: string;
};

/** Renders admin-authored Tiptap HTML with theme-safe typography */
export function BlogArticle({ html, className }: BlogArticleProps) {
  return (
    <article
      className={cn(
        "blog-article text-foreground [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold",
        "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_p]:mb-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground",
        "[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_li]:mb-1 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_a]:text-primary [&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground",
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
