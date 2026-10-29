import { redirect } from "next/navigation";

export default async function LegacyChatbotRecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ schema?: string }>;
}) {
  const { schema } = await searchParams;
  redirect(schema ? `/dashboard/records/${encodeURIComponent(schema)}` : "/dashboard/records");
}
