"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ArrowRight, FileText, Mail, Shield, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MODULES = [
  {
    href: "/admin/contacts",
    icon: Mail,
    titleKey: "sidebar.contacts",
    desc: "Review contact and demo form submissions.",
    ready: true,
  },
  {
    href: "/admin/users",
    icon: Users,
    titleKey: "sidebar.users",
    desc: "Manage platform users and roles.",
    ready: true,
  },
  {
    href: "/admin/platforms",
    icon: Shield,
    titleKey: "sidebar.platforms",
    desc: "Configure available integrations.",
    ready: true,
  },
  {
    href: "/admin/blog",
    icon: FileText,
    titleKey: "sidebar.blog",
    desc: "Create and publish blog posts.",
    ready: true,
  },
];

export default function AdminDashboardPage() {
  const { t } = useTranslation("admin");

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8"
      >
        <h1 className="text-2xl font-bold tracking-tight text-brand-gradient md:text-3xl">
          {t("dashboard.welcome")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          {t("dashboard.description")}
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ href, icon: Icon, titleKey, desc, ready }, index) => (
          <motion.div
            key={titleKey}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06 }}
          >
            <Card className="border-primary/10 bg-card/60 backdrop-blur-sm h-full">
              <CardHeader className="pb-2">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{t(titleKey)}</CardTitle>
                <CardDescription>{desc}</CardDescription>
              </CardHeader>
              <CardContent>
                {ready ? (
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <Link href={href}>
                      Open
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Coming next</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
