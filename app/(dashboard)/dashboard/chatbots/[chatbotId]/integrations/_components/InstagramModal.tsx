"use client";

import Image from "next/image";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type InstagramAccount = {
  id: string;
  username?: string | null;
  name?: string | null;
  profilePictureUrl?: string | null;
  pageId: string;
  pageName: string;
};

interface InstagramModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadingAccounts: boolean;
  accounts: InstagramAccount[];
  pagesWithoutInstagram?: { pageId: string; pageName: string }[];
  managedPageCount?: number;
  selectedAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onConnect: () => void;
  onInstagramLoginConnect?: () => void;
  onFacebookConnect?: () => void;
}

export const InstagramModal = ({
  open,
  onOpenChange,
  loadingAccounts,
  accounts,
  pagesWithoutInstagram = [],
  managedPageCount = 0,
  selectedAccountId,
  onSelectAccount,
  onConnect,
  onInstagramLoginConnect,
  onFacebookConnect,
}: InstagramModalProps) => {
  const { t } = useTranslation("chatbots");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{t("instagram_modal.title")}</DialogTitle>
          <DialogDescription>{t("instagram_modal.description")}</DialogDescription>
        </DialogHeader>

        {onInstagramLoginConnect ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-medium text-foreground">{t("instagram_modal.loginMethodTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("instagram_modal.loginMethodHint")}</p>
            <Button type="button" className="mt-3 w-full rounded-xl" onClick={onInstagramLoginConnect}>
              {t("instagram_modal.loginWithInstagram")}
            </Button>
            {onFacebookConnect ? (
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full rounded-xl"
                onClick={onFacebookConnect}
                disabled={loadingAccounts}
              >
                {loadingAccounts ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("instagram_modal.viaFacebookPage")}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="max-h-[320px] space-y-3 overflow-y-auto py-3 pr-2">
          {loadingAccounts ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mb-2 size-8 animate-spin text-primary" />
              <p className="text-sm">{t("instagram_modal.fetching")}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="text-center">{t("instagram_modal.empty")}</p>
              <p className="text-center text-xs">{t("instagram_modal.emptyHint")}</p>
              {managedPageCount === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No Facebook Pages were returned for this login. Sign in with the Facebook profile that manages your
                  business Page (e.g. Driplare Page).
                </p>
              ) : null}
              {pagesWithoutInstagram.length > 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left text-xs">
                  <p className="font-medium text-foreground">
                    {managedPageCount} Page(s) found, but Instagram is not linked on:
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {pagesWithoutInstagram.map((page) => (
                      <li key={page.pageId}>{page.pageName}</li>
                    ))}
                  </ul>
                  <p className="mt-2">{t("instagram_modal.pageLinkHint")}</p>
                  {onInstagramLoginConnect ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full rounded-lg"
                      onClick={onInstagramLoginConnect}
                    >
                      {t("instagram_modal.loginWithInstagram")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onSelectAccount(account.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  selectedAccountId === account.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-sm font-bold text-primary">
                  {account.profilePictureUrl ? (
                    <Image
                      src={account.profilePictureUrl}
                      alt={account.username || account.name || "Instagram account"}
                      width={44}
                      height={44}
                      unoptimized
                      className="size-full object-cover"
                    />
                  ) : (
                    (account.username || account.name || "I").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {account.username ? `@${account.username}` : account.name || account.id}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("instagram_modal.linkedPage", { page: account.pageName })}
                  </p>
                </div>
                {selectedAccountId === account.id ? <CheckCircle2 className="size-5 shrink-0 text-primary" /> : null}
              </button>
            ))
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t("instagram_modal.cancel")}
          </Button>
          <Button onClick={onConnect} disabled={!selectedAccountId || loadingAccounts} className="rounded-xl">
            {loadingAccounts ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("instagram_modal.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
