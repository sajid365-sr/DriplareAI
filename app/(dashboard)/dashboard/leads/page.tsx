import { redirect } from "next/navigation";

/**
 * /dashboard/leads is now /dashboard/contacts.
 * This redirect ensures old bookmarks and external links still work.
 */
export default function LeadsRedirectPage() {
  redirect("/dashboard/contacts");
}
