/**
 * Tab ↔ URL param mappings for the Global Live Inbox.
 * Shared between useInboxUrlSync and useInboxSessionFilters.
 */

/** Maps URL `?tab=` param values to internal tab keys */
export const TAB_PARAM_MAP: Record<string, string> = {
  waiting: "waiting",
  unread: "unread",
  open: "open",
  done: "done",
  later: "later",
  archived: "archived",
};

/** Maps internal tab keys back to URL param values */
export const TAB_KEY_TO_PARAM: Record<string, string> = {
  waiting: "waiting",
  unread: "unread",
  open: "open",
  done: "done",
  later: "later",
  archived: "archived",
};
