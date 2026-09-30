import { redirect } from "next/navigation";

/**
 * পুরনো ঠিকানা — কেবল redirect।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * পেজটা এখন দুই ভাগে ভাগ হয়েছে: কনফিগারেশন `/setup`-এ, আর পরখ করা
 * `/playground`-এ। কিন্তু আগের `/chat` লিংকটা এখনো অনেক জায়গায় বাঁচে:
 * ব্রাউজারের bookmark, merchant-দের পুরনো screenshot বা শেয়ার করা লিংক।
 * ওগুলো যাতে ৪০৪-এ শেষ না হয়, তাই রুটটা মোছা হয়নি।
 *
 * ⚠️ গন্তব্য `/playground` — কারণ "chat" মানে "আমার বটের সাথে কথা বলা", আর
 *    সেটা এখন ঠিক ওই পেজটাই। `/setup`-এ পাঠালে কেউ বটের সাথে কথা বলতে গিয়ে
 *    prompt-এর ফর্মে পড়ত।
 *
 * ⚠️ কিন্তু `/api/chatbots/[chatbotId]/chat` **একই কারণে rename করা হয়নি** —
 *    ওটা rename করলে n8n-এর লাইভ Facebook/WhatsApp reply ভাঙত, অথচ কোথাও
 *    কোনো compile error দেখাত না। অর্থাৎ UI-র রুট আর API-র রুট এখানে ইচ্ছে
 *    করেই আলাদা নামে: ব্যবহারকারীর ভাষা "Playground", মেশিনের ঠিকানা "chat"।
 */
export default async function ChatRedirect({
  params,
}: {
  params: Promise<{ chatbotId: string }>;
}) {
  const { chatbotId } = await params;
  redirect(`/dashboard/chatbots/${chatbotId}/playground`);
}
