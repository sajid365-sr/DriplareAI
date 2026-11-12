"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/language-toggle";
import { ModeToggle } from "@/components/mode-toggle";
import { BrandLogo } from "@/components/layout/BrandLogo";
import {
  BUSINESS_ONBOARDING_STORAGE_KEY,
  businessOnboardingDraftSchema,
  businessOnboardingSchema,
  type BusinessOnboardingDraft,
} from "@/lib/domain/business-onboarding";
import { WORKSPACE_BUSINESS_CATEGORIES } from "@/lib/domain/workspace-business-categories";

const INITIAL_DRAFT: BusinessOnboardingDraft = {
  requestId: "",
  name: "",
  category: "",
  customBusinessTitle: "",
  logoUrl: null,
};

const STEP_LABELS = [
  "business.stepCategory",
  "business.stepName",
  "business.stepZone",
  "business.stepLogo",
] as const;

async function resizeLogo(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("logo-too-large");
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("logo-read-failed"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("logo-read-failed"));
        return;
      }

      const image = new Image();
      image.onerror = () => reject(new Error("logo-read-failed"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("logo-read-failed"));
          return;
        }

        const side = Math.min(image.width, image.height);
        const left = (image.width - side) / 2;
        const top = (image.height - side) / 2;
        context.drawImage(image, left, top, side, side, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function BusinessOnboardingWizard() {
  const { t } = useTranslation(["auth", "common"]);
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const [form, setForm] = useState(INITIAL_DRAFT);
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    let restoredForm: BusinessOnboardingDraft | null = null;
    let restoreError: string | null = null;

    try {
      const saved = window.sessionStorage.getItem(BUSINESS_ONBOARDING_STORAGE_KEY);
      if (saved) {
        const result = businessOnboardingDraftSchema.safeParse(JSON.parse(saved));
        if (result.success) {
          restoredForm = result.data;
        } else {
          restoreError = t("business.invalidDraft");
        }
      }
    } catch {
      restoreError = t("business.storageError");
    }

    queueMicrotask(() => {
      if (cancelled) return;
      if (restoredForm) setForm(restoredForm);
      if (restoreError) setError(restoreError);
      setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const updateForm = (patch: Partial<BusinessOnboardingDraft>) => {
    const updated = { ...form, ...patch };
    setForm(updated);
    try {
      window.sessionStorage.setItem(
        BUSINESS_ONBOARDING_STORAGE_KEY,
        JSON.stringify(updated)
      );
      setError(null);
    } catch {
      setError(t("business.storageError"));
    }
  };

  const handleLogoChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLogoLoading(true);
    try {
      updateForm({ logoUrl: await resizeLogo(file) });
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "logo-too-large"
          ? t("business.logoTooLarge")
          : t("business.logoError")
      );
    } finally {
      setLogoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const finish = () => {
    const result = businessOnboardingSchema.safeParse({
      ...form,
      requestId: form.requestId || crypto.randomUUID(),
      name: form.name.trim(),
      customBusinessTitle: form.customBusinessTitle.trim(),
    });
    if (!result.success) {
      setError(
        result.error.issues[0]?.path.includes("category")
          ? t("business.categoryRequired")
          : t("business.nameRequired")
      );
      return;
    }

    try {
      window.sessionStorage.setItem(
        BUSINESS_ONBOARDING_STORAGE_KEY,
        JSON.stringify(result.data)
      );
    } catch {
      setError(t("business.storageError"));
      return;
    }

    if (isLoaded && isSignedIn) {
      router.push("/onboarding/business/complete");
    } else {
      router.push("/sign-up?flow=business");
    }
  };

  const handleContinue = () => {
    setError(null);
    if (step === 0 && !form.category) {
      setError(t("business.categoryRequired"));
      return;
    }
    if (step === 1 && !form.name.trim()) {
      setError(t("business.nameRequired"));
      return;
    }
    if (step === STEP_LABELS.length - 1) {
      finish();
      return;
    }
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    setError(null);
    if (step === 0) {
      router.push("/get-started");
      return;
    }
    setStep((current) => current - 1);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        {t("business.title")}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border/70 px-4 sm:px-8">
        <Link href="/" aria-label={t("brand", { ns: "common" })}>
          <BrandLogo className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-8 sm:pt-12">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("business.eyebrow")}
        </p>
        <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("business.title")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-6 text-muted-foreground">
          {t("business.subtitle")}
        </p>

        <ol
          aria-label={t("business.title")}
          className="my-8 grid grid-cols-4 gap-2 sm:my-10 sm:gap-4"
        >
          {STEP_LABELS.map((label, index) => {
            const complete = index < step;
            const active = index === step;
            return (
              <li key={label} aria-current={active ? "step" : undefined}>
                <div
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                    complete || active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {complete ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <p
                  className={`mt-2 text-center text-[10px] leading-4 sm:text-xs ${
                    active ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t(label)}
                </p>
                {index < STEP_LABELS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`relative -z-10 mx-auto -mt-[3.55rem] hidden h-px w-full translate-x-1/2 sm:block ${
                      complete ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-primary/5 sm:p-8">
          <p className="text-xs font-medium text-muted-foreground">
            {t("business.stepOf", {
              current: step + 1,
              total: STEP_LABELS.length,
            })}
          </p>

          {step === 0 && (
            <div className="mt-4">
              <h2 className="text-xl font-semibold">{t("business.categoryTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("business.categoryDescription")}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {WORKSPACE_BUSINESS_CATEGORIES.map((category) => {
                  const selected = form.category === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateForm({ category: category.id })}
                      className={`min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      {t(category.labelKey, {
                        ns: "common",
                        defaultValue: category.label,
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="mt-4 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">{t("business.nameTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("business.nameDescription")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-name">{t("business.nameLabel")}</Label>
                <Input
                  id="business-name"
                  autoFocus
                  autoComplete="organization"
                  maxLength={100}
                  value={form.name}
                  placeholder={t("business.namePlaceholder")}
                  onChange={(event) => updateForm({ name: event.target.value })}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-4 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">{t("business.zoneTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("business.zoneDescription")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-zone">{t("business.zoneLabel")}</Label>
                <Input
                  id="business-zone"
                  maxLength={60}
                  value={form.customBusinessTitle}
                  placeholder={t("business.zonePlaceholder")}
                  onChange={(event) =>
                    updateForm({ customBusinessTitle: event.target.value })
                  }
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-4 space-y-5">
              <div>
                <h2 className="text-xl font-semibold">{t("business.logoTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("business.logoDescription")}
                </p>
              </div>
              <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border p-5 sm:flex-row sm:items-center">
                {form.logoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.logoUrl}
                      alt={t("business.logoTitle")}
                      className="h-16 w-16 rounded-xl border border-border object-cover"
                    />
                    <button
                      type="button"
                      aria-label={t("business.removeLogo")}
                      onClick={() => updateForm({ logoUrl: null })}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ImagePlus className="h-6 w-6" />
                  </span>
                )}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("business.logoHint")}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => handleLogoChange(event.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={logoLoading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoLoading
                      ? t("business.uploadingLogo")
                      : t("business.uploadLogo")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button type="button" variant="ghost" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("business.back")}
            </Button>
            <Button
              type="button"
              onClick={handleContinue}
              disabled={logoLoading}
              className="bg-brand-gradient text-white hover:opacity-90"
            >
              {step === STEP_LABELS.length - 1
                ? t("business.finish")
                : t("business.continue")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
