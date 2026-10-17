import { redirect } from "next/navigation";

/**
 * পুরনো ঠিকানা — কেবল redirect।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Compare এখন Playground পেজের ভেতরে একটা মোড (`Compare Arena`), আলাদা পাতা
 * নয়। কিন্তু রুটটা মোছা হয়নি, কারণ আগের লিংকগুলো এখনো বাঁচে: বুকমার্ক,
 * মার্চেন্টদের শেয়ার করা লিংক, পুরনো screenshot।
 *
 * ⚠️ গন্তব্য `/playground` — মোডটা ক্লায়েন্ট state, তাই redirect দিয়ে সোজা
 *    এরিনা বেছে দেওয়ার উপায় নেই। ব্যবহারকারী Playground-এ গিয়ে টগলটা দেখতে
 *    পান, যেটা এই redirect-এর চেয়ে স্পষ্ট।
 */
export default async function CompareRedirect({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;
  redirect(`/dashboard/chatbots/${chatbotId}/playground`);
}
