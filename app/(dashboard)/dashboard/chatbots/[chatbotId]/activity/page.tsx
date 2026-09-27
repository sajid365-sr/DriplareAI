import { redirect } from "next/navigation";

export default function ChatbotActivityRedirectPage() {
  // Legacy Activity tab deprecated & redirected to unified global Live Inbox
  redirect("/dashboard/inbox");
}
