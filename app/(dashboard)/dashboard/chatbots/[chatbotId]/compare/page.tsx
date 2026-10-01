import { redirect } from "next/navigation";

/**
 * পুরনো ঠিকানা — কেবল redirect।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Model Compare আর আলাদা কোনো গন্তব্য নয়, এমনকি Playground-এর ভেতরের আলাদা
 * রুটও নয় — এখন এটা Playground পেজের একটা **মোড** (`Compare Arena`)।
 *
 * পুরনো `/compare` লিংকটা (সাইডবারের পুরনো এন্ট্রি, bookmark, শেয়ার করা লিংক)
 * যাতে ৪০৪ না হয়, তাই রুটটা মোছা হয়নি — সোজা Playground-এ পাঠিয়ে দেওয়া হয়।
 * ⚠️ মোডটা ক্লায়েন্ট state, তাই redirect দিয়ে সোজা এরিনা বেছে দেওয়ার উপায়
 *    নেই; ব্যবহারকারী গিয়ে টগলটা দেখতে পান।
 */
export default async function CompareRedirect({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;
  redirect(`/dashboard/chatbots/${chatbotId}/playground`);
}
