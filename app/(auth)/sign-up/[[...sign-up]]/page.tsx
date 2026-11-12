import { AuthExperience } from "@/components/auth/auth-experience";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string; redirect_url?: string }>;
}) {
  const { flow, redirect_url } = await searchParams;
  return (
    <AuthExperience
      mode="sign-up"
      businessFlow={flow === "business"}
      showBackLink={!redirect_url}
    />
  );
}
