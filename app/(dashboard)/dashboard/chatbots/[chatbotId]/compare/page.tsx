import { redirect } from "next/navigation";

/**
 * পুরনো ঠিকানা — কেবল redirect।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Model Compare আর আলাদা কোনো গন্তব্য নয়। মডেল বাছাই আর মডেল মেলানো —
 * দুটোই একই কাজের দুই ধাপ (কনফিগ করছি, তারপর ফল মিলিয়ে দেখছি), তাই পেজটা
 * এখন Playground-এর ভেতরে: `/dashboard/chatbots/[chatbotId]/playground/compare`।
 *
 * পুরনো `/compare` লিংকটা (সাইডবারের পুরনো এন্ট্রি, bookmark, শেয়ার করা লিংক)
 * যাতে ৪০৪ না হয়, তাই রুটটা মোছা হয়নি — সোজা ভেতরের ঠিকানায় পাঠিয়ে দেওয়া হয়।
 */
export default async function CompareRedirect({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;
  redirect(`/dashboard/chatbots/${chatbotId}/playground/compare`);
}
