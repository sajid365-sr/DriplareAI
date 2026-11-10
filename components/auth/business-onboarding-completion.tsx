"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setWorkspaceCookie } from "@/lib/core/workspace";
import {
  BUSINESS_ONBOARDING_STORAGE_KEY,
  businessOnboardingSchema,
} from "@/lib/domain/business-onboarding";

export function BusinessOnboardingCompletion() {
  const { t } = useTranslation("auth");
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<{ message: string; missingDetails: boolean } | null>(
    null
  );

  const createWorkspace = useCallback(async () => {
    let data: unknown;
    try {
      const raw = window.sessionStorage.getItem(BUSINESS_ONBOARDING_STORAGE_KEY);
      if (!raw) {
        setError({
          message: t("business.missingDetails"),
          missingDetails: true,
        });
        return;
      }
      const result = businessOnboardingSchema.safeParse(JSON.parse(raw));
      if (!result.success) {
        setError({
          message: t("business.missingDetails"),
          missingDetails: true,
        });
        return;
      }

      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.data.name,
          category: result.data.category,
          customBusinessTitle: result.data.customBusinessTitle,
          logoUrl: result.data.logoUrl,
          onboardingRequestId: result.data.requestId,
        }),
      });
      if (!response.ok) {
        throw new Error(`Workspace creation failed (${response.status})`);
      }
      data = await response.json();
    } catch (reason) {
      console.error("[BusinessOnboarding] workspace creation failed", reason);
      setError({
        message: t("business.completeErrorDescription"),
        missingDetails: false,
      });
      return;
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("workspaceId" in data) ||
      typeof data.workspaceId !== "string"
    ) {
      console.error("[BusinessOnboarding] response did not include a workspace ID");
      setError({
        message: t("business.completeErrorDescription"),
        missingDetails: false,
      });
      return;
    }

    setWorkspaceCookie(data.workspaceId);
    window.sessionStorage.removeItem(BUSINESS_ONBOARDING_STORAGE_KEY);
    router.replace("/dashboard/setup");
  }, [router, t]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in?flow=business");
      return;
    }
    if (started.current) return;
    started.current = true;
    void createWorkspace();
  }, [createWorkspace, isLoaded, isSignedIn, router]);

  const retry = () => {
    setError(null);
    void createWorkspace();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-7 text-center shadow-xl shadow-primary/5 sm:p-9">
        {error ? (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">
              {t("business.completeErrorTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {error.message}
            </p>
            {error.missingDetails ? (
              <Button asChild className="mt-6 bg-brand-gradient text-white">
                <Link href="/get-started/business">{t("business.reviewDetails")}</Link>
              </Button>
            ) : (
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={retry} className="bg-brand-gradient text-white">
                  {t("business.retry")}
                </Button>
                <Button asChild variant="outline">
                  <Link href="/get-started/business">{t("business.reviewDetails")}</Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </span>
            <h1 className="mt-5 text-xl font-semibold">
              {t("business.completeTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("business.completeDescription")}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
