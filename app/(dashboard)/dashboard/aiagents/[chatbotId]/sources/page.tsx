import { redirect } from "next/navigation";

/**
 * The Sources page is retired.
 *
 * Knowledge has exactly one owner now — the Knowledge Base — and this route was
 * a second, less complete copy of it: its four upload tabs are still shared with
 * the Knowledge Base (which imports them from `./_components`), but the page
 * around them carried its own load/delete/edit logic and was never linked from
 * anywhere in the product.
 *
 * Kept as a redirect rather than deleted so the bookmarks and browser history of
 * merchants who used it before the merge still land somewhere useful.
 */
export default async function SourcesRedirect({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;
  redirect(`/dashboard/knowledge-base?botId=${chatbotId}`);
}
