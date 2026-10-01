import type { CourierConfigPayload, CourierForm, CourierProvider } from "./types";

/** Blank form — the starting state, and the fallback when nothing is saved yet. */
export const EMPTY_COURIER_FORM: CourierForm = {
  steadfastEnabled: false,
  steadfastApiKey: "",
  steadfastSecretKey: "",
  pathaoEnabled: false,
  pathaoClientId: "",
  pathaoClientSecret: "",
  pathaoUsername: "",
  pathaoPassword: "",
  pathaoStoreId: "",
  redxEnabled: false,
  redxApiToken: "",
};

/**
 * The couriers this page configures.
 *
 * Written as data rather than three hand-built cards: the markup lives once in
 * `CourierProviderCard`, so adding a courier means one entry here plus its
 * `providers.<id>` and `fields.<key>` strings in the locale files.
 *
 * Badge tints use semantic tokens (success / info / warning) instead of a raw
 * palette, so they follow the theme in both light and dark mode — the
 * `rose-600 dark:rose-400` pairs the old settings page carried would not.
 */
export const COURIER_PROVIDERS: CourierProvider[] = [
  {
    id: "steadfast",
    emoji: "🚚",
    badgeClass: "bg-success/10 text-success",
    enabledKey: "steadfastEnabled",
    fields: [
      { key: "steadfastApiKey", secret: true },
      { key: "steadfastSecretKey", secret: true },
    ],
  },
  {
    id: "pathao",
    emoji: "🏍️",
    badgeClass: "bg-info/10 text-info",
    enabledKey: "pathaoEnabled",
    fields: [
      { key: "pathaoClientId" },
      { key: "pathaoClientSecret", secret: true },
      { key: "pathaoUsername", mono: false },
      { key: "pathaoPassword", secret: true },
      { key: "pathaoStoreId", fullWidth: true },
    ],
  },
  {
    id: "redx",
    emoji: "📦",
    badgeClass: "bg-warning/10 text-warning",
    enabledKey: "redxEnabled",
    fields: [{ key: "redxApiToken", secret: true }],
  },
];

/** Maps an API payload onto form state, tolerating absent or null columns. */
export function toCourierForm(config?: CourierConfigPayload | null): CourierForm {
  if (!config) return EMPTY_COURIER_FORM;

  return {
    steadfastEnabled: !!config.steadfastEnabled,
    steadfastApiKey: config.steadfastApiKey || "",
    steadfastSecretKey: config.steadfastSecretKey || "",
    pathaoEnabled: !!config.pathaoEnabled,
    pathaoClientId: config.pathaoClientId || "",
    pathaoClientSecret: config.pathaoClientSecret || "",
    pathaoUsername: config.pathaoUsername || "",
    pathaoPassword: config.pathaoPassword || "",
    pathaoStoreId: config.pathaoStoreId || "",
    redxEnabled: !!config.redxEnabled,
    redxApiToken: config.redxApiToken || "",
  };
}
