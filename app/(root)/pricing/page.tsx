"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ArrowLeft, Sparkles, Zap, Crown, Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { usePricing, useRegion } from "@/components/region-provider";
import BookDemoModal from "@/components/landing/BookDemoModal";
import { resolveLocalStr } from "@/lib/domain/plan-config";
import { formatPrice, type BillingCycle } from "@/lib/domain/pricing-catalogue";

const PLAN_ICONS = {
  starter: Sparkles,
  growth: Zap,
  business: Crown,
  enterprise: Building2,
};

export default function PricingPage() {
  const { t, i18n } = useTranslation(["pricing", "common"]);
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { region, config: regionConfig } = useRegion();
  const { plans, listPrice, publicPrice, annualDiscountPercent } = usePricing();

  // ⚠️ `usePricing()` — `getPlansForRegion()` **নয়**। সরাসরি ডাকলে override-হীন
  //    তালিকা আসত, অর্থাৎ admin একটি দাম বদলালেও এই পর্দায় সেটি পৌঁছাত না।
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  // Global region-এ কেনার সুবিধা নেই — তাই CTA দেখানো হয় না, শুধু দাম দেখা যায়।
  const paymentAvailable = regionConfig.paymentGateway !== null;

  // নেগোসিয়েটেড tier-এর একমাত্র পথ: কথা বলা। gateway বা account লাগে না।
  const [contactOpen, setContactOpen] = useState(false);

  const lang = i18n.language;

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          data-testid="back-home"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {i18n.language === "bn" ? "ফিরে যান" : "Back"}
        </Link>

        <div className="text-center mt-8 mb-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter">
            {t("pricing.title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("pricing.subtitle")}</p>
        </div>

        {/* ── মাসিক ⇄ বার্ষিক (১৫.৭) ─────────────────────────────────────────
            ⚠️ বার্ষিক ছাড়ের শতাংশটি **ক্যাটালগ থেকে** — admin এটি বদলালে পর্দার
            লেখাও ("২৫% সাশ্রয়") সাথে সাথে বদলায়। হার্ডকোড করলে admin একটি
            সংখ্যা বদলে দিলে পর্দা মিথ্যা বিজ্ঞাপন দেখাত। */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div
            role="tablist"
            aria-label={t("pricing.cycleLabel", "Billing cycle")}
            className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1"
          >
            {(["monthly", "yearly"] as const).map((option) => (
              <button
                key={option}
                role="tab"
                aria-selected={cycle === option}
                onClick={() => setCycle(option)}
                data-testid={`cycle-${option}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  cycle === option
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`pricing.${option}`)}
              </button>
            ))}
          </div>

          {cycle === "yearly" && annualDiscountPercent > 0 && (
            <p className="text-xs font-medium text-primary">
              {t("pricing.yearlySaving", {
                percent: annualDiscountPercent,
                defaultValue: "Save {{percent}}% with annual billing",
              })}
            </p>
          )}
        </div>

        <div
          className={`grid gap-6 mx-auto ${
            plans.length === 2
              ? "md:grid-cols-2 max-w-3xl"
              : plans.length >= 4
                ? "md:grid-cols-4 max-w-6xl"
                : "md:grid-cols-3 max-w-5xl"
          }`}
        >
          {plans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.key] || Sparkles;
            // ⚠️ দাম আর লেবেল **একসাথে** এই একটি কলে — `plan.price` সরাসরি পড়লে
            //    শুধু মাসিক দামই পাওয়া যেত, আর বার্ষিক toggle কিছুই করত না।
            const price = listPrice(plan, cycle, lang);

            // ⚠️ **এখানেই সবচেয়ে জরুরি লাইনটি।** `listPrice` তালিকা-দাম দেয়
            //    (override + বার্ষিক ছাড়), কিন্তু region-ব্যাপী ছাড় বসে
            //    checkout-এ (`resolveCheckoutAmount`)। শুধু `price.label`
            //    দেখালে admin ২০% ঘোষিত ছাড় দিলে পর্দায় ৳৯৯৯ দেখাত অথচ চার্জ
            //    হত ৳৭৯৯ — অর্থাৎ পর্দার দাম আর চার্জের দাম আলাদা, যা এই
            //    প্ল্যাটফর্মে সবচেয়ে খারাপ ধরনের বাগ। তাই ঠিক সেই ফাংশনটিই
            //    এখানে ডাকা হয় যা checkout-এ ডাকা হয়।
            const charged = publicPrice(price.amount, "plan");
            const hasDiscount = !plan.contact && charged.discountAmount > 0;
            const finalLabel = formatPrice(charged.finalAmount, region, lang);

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col p-8 rounded-2xl bg-card border ${plan.featured
                    ? "border-primary shadow-xl md:-translate-y-4"
                    : "border-border shadow-sm"
                  }`}
                data-testid={`tier-${plan.key}`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase">
                    {t("pricing.featured")}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-1">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-lg">{resolveLocalStr(plan.name, i18n.language)}</h3>
                </div>

                <div className="text-4xl font-bold tracking-tighter mt-6">
                  {hasDiscount ? (
                    <>
                      {/* ঘোষিত ছাড় — মূল দাম কাটা, পাশে ছাড়-লেবেল */}
                      <span className="mr-2 text-lg font-normal text-muted-foreground line-through">
                        {price.label}
                      </span>
                      <span className="text-primary">{finalLabel}</span>
                    </>
                  ) : (
                    price.label
                  )}
                  {!plan.contact && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /{cycle === "yearly" ? t("pricing.perYear") : t("pricing.perMonth")}
                    </span>
                  )}
                </div>

                {/* বার্ষিক দামের নিচে মাসিক সমতুল্য — "মাসে ৳৭৪৯" জাতীয় তুলনা */}
                {cycle === "yearly" && !plan.contact && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("pricing.perMonthEquivalent", {
                      amount: formatPrice(
                        Math.round((charged.finalAmount / 12) * 100) / 100,
                        region,
                        lang
                      ),
                      defaultValue: "{{amount}}/mo equivalent",
                    })}
                  </p>
                )}

                <ul className="space-y-3 mt-6 flex-grow">
                  {plan.features.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" /> {resolveLocalStr(f, i18n.language)}
                    </li>
                  ))}
                  {plan.key !== "starter" && plan.includedCredits !== Infinity && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      {resolveLocalStr(plan.perCreditLabel, i18n.language)} {t("pricing.perMessage", "per credit after quota")}
                    </li>
                  )}
                </ul>

                {/* নেগোসিয়েটেড tier (Enterprise) — checkout নয়, আলোচনা (১৫.৫)।
                    আগে এখানেও `router.push("/dashboard/payment")` ছিল, অর্থাৎ
                    গ্রাহক "Choose plan" চেপে একটি dead end ঘুরে আসতেন: ওই plan-এর
                    কোনো package কেনা যায় না (`isPackageAllowedForPlan`), কারণ
                    প্রকাশিত দামই নেই। এই CTA gateway-এর উপর নির্ভর করে না —
                    কথাবার্তার জন্য payment gateway লাগে না, তাই Global region-এও
                    (যেখানে gateway নেই) Enterprise-এর রূপান্তরের পথটি খোলা থাকে। */}
                {plan.contact ? (
                  <Button
                    className={`mt-8 rounded-full ${plan.featured ? "bg-primary hover:bg-primary/90 text-primary-foreground" : ""}`}
                    variant={plan.featured ? "default" : "outline"}
                    onClick={() => setContactOpen(true)}
                    data-testid={`tier-cta-${plan.key}`}
                  >
                    {t("pricing.contactCta")}
                  </Button>
                ) : (
                  paymentAvailable &&
                  (isSignedIn ? (
                    <Button
                      className={`mt-8 rounded-full ${plan.featured
                          ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                          : ""
                        }`}
                      variant={plan.featured ? "default" : "outline"}
                      // cycle-টি query-তে যায় — payment পর্দা এটিই পড়ে
                      // checkout-এ পাঠায়, আর দাম **সেখানে server-এ** আবার
                      // গণনা হয় (client-এর সংখ্যা বিশ্বাস করা হয় না)।
                      onClick={() =>
                        router.push(
                          `/dashboard/payment?plan=${plan.key}&cycle=${cycle}`
                        )
                      }
                      data-testid={`tier-cta-${plan.key}`}
                    >
                      {t("pricing.cta")}
                    </Button>
                  ) : (
                    <Link href="/sign-up">
                      <Button
                        className={`mt-8 rounded-full w-full ${plan.featured
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : ""
                          }`}
                        variant={plan.featured ? "default" : "outline"}
                        data-testid={`tier-cta-${plan.key}`}
                      >
                        {t("pricing.cta")}
                      </Button>
                    </Link>
                  ))
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Payment না থাকা region-এ কেন CTA নেই, তা স্পষ্ট করা হয় */}
        {!paymentAvailable && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            {t("pricing.paymentUnavailable")}
          </p>
        )}
      </div>

      {/* একই contact form — landing page-এর Demo modal আর এখানে একটিই component,
          তাই `/api/contact`-এর validation ও copy এক জায়গায় থাকে। */}
      <BookDemoModal
        open={contactOpen}
        onOpenChange={setContactOpen}
        source="enterprise_enquiry"
        namespace="pricing"
        keyRoot="pricing.contactModal"
        messageIntro="Enterprise plan enquiry."
      />
    </div>
  );
}
