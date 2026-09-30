import { redirect } from "next/navigation";

/**
 * পুরনো ঠিকানা — কেবল redirect।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * পেজটার নাম এখন **Playground**, তাই আসল রুট
 * `/dashboard/chatbots/[chatbotId]/playground`। কিন্তু আগের `/chat` লিংকটা
 * এখনো অনেক জায়গায় বাঁচে: ব্রাউজারের bookmark, merchant-দের পুরনো screenshot
 * বা শেয়ার করা লিংক, আর `create-agent-dialog`-এর আগের redirect। ওগুলো যাতে
 * ৪০৪-এ শেষ না হয়, তাই রুটটা মোছা হয়নি — এখান থেকে সোজা পাঠিয়ে দেওয়া হয়।
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
