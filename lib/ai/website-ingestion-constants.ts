export const MAX_WEBSITE_PAGES_PER_BATCH = 5;
export const MAX_WEBSITE_MAP_RESULTS = 5000;
export const RETRYABLE_WEBSITE_PAGE_STATUSES = ["pending", "failed"] as const;

export function isWebsitePageSelectable(status: string): boolean {
  return RETRYABLE_WEBSITE_PAGE_STATUSES.some((selectableStatus) => selectableStatus === status);
}
