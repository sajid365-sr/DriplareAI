"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { TAB_PARAM_MAP, TAB_KEY_TO_PARAM } from "./constants";

interface UseInboxUrlSyncReturn {
  /** The resolved internal tab key (e.g. "allContacts", "orderRequests") */
  activeStatusTab: string;
  /** Update the URL `?tab=` param when the user switches tabs */
  handleStatusTabChange: (tab: string) => void;
}

/**
 * Syncs the inbox status tab selection with the URL `?tab=` search param.
 * Provides a stable `activeStatusTab` value and a setter that pushes
 * the updated URL without a full page reload.
 */
export function useInboxUrlSync(): UseInboxUrlSyncReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTabParam = searchParams.get("tab");
  const activeStatusTab =
    TAB_PARAM_MAP[currentTabParam?.toLowerCase() || ""] || "allContacts";

  const handleStatusTabChange = useCallback(
    (newTab: string) => {
      const paramVal = TAB_KEY_TO_PARAM[newTab] || "all";
      const params = new URLSearchParams(searchParams.toString());
      if (paramVal === "all") {
        params.delete("tab");
      } else {
        params.set("tab", paramVal);
      }
      const queryStr = params.toString();
      router.push(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { activeStatusTab, handleStatusTabChange };
}
