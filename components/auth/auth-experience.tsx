"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/components/auth/auth-shell";

const BUSINESS_COMPLETION_URL = "/onboarding/business/complete";
const SETUP_URL = "/dashboard/setup";
const DASHBOARD_URL = "/dashboard/overview";

export function AuthExperience({
  mode,
  businessFlow,
  showBackLink = true,
}: {
  mode: "sign-in" | "sign-up";
  businessFlow: boolean;
  showBackLink?: boolean;
}) {
  const { t } = useTranslation("auth");
  const signUpRedirectUrl = businessFlow ? BUSINESS_COMPLETION_URL : SETUP_URL;
  const signInUrl = businessFlow ? "/sign-in?flow=business" : "/sign-in";
  const signUpUrl = businessFlow ? "/sign-up?flow=business" : "/sign-up";
  const appearance = {
    elements: {
      rootBox: "w-full",
      card: "w-full rounded-2xl border border-border bg-card shadow-lg shadow-primary/5",
      headerTitle: "text-foreground",
      headerSubtitle: "text-muted-foreground",
      formFieldLabel: "text-foreground",
      formFieldInput: "border-border bg-background text-foreground",
      footer: "bg-transparent",
      footerActionLink: "font-semibold text-primary hover:text-primary/80",
    },
  };

  return (
    <AuthShell showBackLink={showBackLink}>
      {mode === "sign-in" ? (
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl={signUpUrl}
          fallbackRedirectUrl={DASHBOARD_URL}
          signUpFallbackRedirectUrl={signUpRedirectUrl}
          forceRedirectUrl={DASHBOARD_URL}
          signUpForceRedirectUrl={signUpRedirectUrl}
          appearance={appearance}
        />
      ) : (
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl={signInUrl}
          fallbackRedirectUrl={signUpRedirectUrl}
          signInFallbackRedirectUrl={DASHBOARD_URL}
          forceRedirectUrl={signUpRedirectUrl}
          signInForceRedirectUrl={DASHBOARD_URL}
          appearance={appearance}
        />
      )}
      {(businessFlow || mode === "sign-up") && (
        <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
          {t(businessFlow ? "auth.businessNote" : "auth.personalNote")}
        </p>
      )}
    </AuthShell>
  );
}
