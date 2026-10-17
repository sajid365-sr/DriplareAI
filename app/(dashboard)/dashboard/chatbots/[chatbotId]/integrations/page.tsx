import { redirect } from "next/navigation";

/**
 * The per-chatbot Integrations page is retired.
 *
 * Channels have one owner now — `/dashboard/platforms` — which also absorbed the
 * flows that only ever existed here: the Website Widget embed code, and the
 * generic connect used by Telegram, Slack, Custom API and anything else an admin
 * activates in `/admin/platforms`.
 *
 * Kept as a redirect rather than deleted so the Instagram OAuth return URL and
 * any merchant bookmark still land somewhere useful.
 */
export default async function IntegrationsRedirect({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;
  redirect(`/dashboard/platforms?botId=${chatbotId}`);
}
