"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";

export function LocalizedClerkProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation("auth");
  const localization = {
    locale: i18n.language.startsWith("bn") ? "bn-BD" : "en-US",
    dividerText: t("auth.clerk.divider"),
    formButtonPrimary: t("auth.clerk.continue"),
    socialButtonsBlockButton: t("auth.clerk.socialButton", {
      provider: "{{provider}}",
    }),
    formFieldLabel__emailAddress: t("auth.clerk.email"),
    formFieldLabel__password: t("auth.clerk.password"),
    formFieldLabel__newPassword: t("auth.clerk.createPasswordLabel"),
    formFieldLabel__firstName: t("auth.clerk.firstName"),
    formFieldLabel__lastName: t("auth.clerk.lastName"),
    formFieldInputPlaceholder__emailAddress: t("auth.clerk.emailPlaceholder"),
    formFieldInputPlaceholder__password: t("auth.clerk.passwordPlaceholder"),
    formFieldInputPlaceholder__signUpPassword: t(
      "auth.clerk.createPasswordPlaceholder"
    ),
    formFieldInputPlaceholder__firstName: t("auth.clerk.firstName"),
    formFieldInputPlaceholder__lastName: t("auth.clerk.lastName"),
    signIn: {
      start: {
        title: t("auth.clerkSignInTitle"),
        titleCombined: t("auth.clerkSignInTitle"),
        subtitle: t("auth.clerk.signInSubtitle"),
        subtitleCombined: t("auth.clerk.signInSubtitle"),
        actionText: t("auth.clerk.signUpPrompt"),
        actionLink: t("auth.signUp"),
      },
    },
    signUp: {
      start: {
        title: t("auth.clerkSignUpTitle"),
        titleCombined: t("auth.clerkSignUpTitle"),
        subtitle: t("auth.clerk.signUpSubtitle"),
        subtitleCombined: t("auth.clerk.signUpSubtitle"),
        actionText: t("auth.clerk.signInPrompt"),
        actionLink: t("auth.signIn"),
      },
    },
  };

  return (
    <ClerkProvider afterSignOutUrl="/" localization={localization}>
      {children}
    </ClerkProvider>
  );
}
