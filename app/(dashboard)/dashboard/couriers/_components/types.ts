/**
 * Types for the courier credential page.
 *
 * `CourierForm` mirrors the `/api/couriers` contract: the route reads each key
 * off the request body and stores it on `CourierConfig`, so these field names
 * double as the payload — renaming one here without renaming it there silently
 * drops the value.
 */

/** Courier credential form values. */
export interface CourierForm {
  // Steadfast
  steadfastEnabled: boolean;
  steadfastApiKey: string;
  steadfastSecretKey: string;
  // Pathao
  pathaoEnabled: boolean;
  pathaoClientId: string;
  pathaoClientSecret: string;
  pathaoUsername: string;
  pathaoPassword: string;
  pathaoStoreId: string;
  // RedX
  redxEnabled: boolean;
  redxApiToken: string;
}

/** Text inputs on the form — everything that is not an on/off switch. */
export type CourierFieldKey =
  | "steadfastApiKey"
  | "steadfastSecretKey"
  | "pathaoClientId"
  | "pathaoClientSecret"
  | "pathaoUsername"
  | "pathaoPassword"
  | "pathaoStoreId"
  | "redxApiToken";

/** The per-provider enable switches. */
export type CourierToggleKey =
  | "steadfastEnabled"
  | "pathaoEnabled"
  | "redxEnabled";

/** Provider ids; each is also the `providers.<id>` key in the `couriers` locale. */
export type CourierProviderId = "steadfast" | "pathao" | "redx";

/** A single credential input inside a provider card. */
export interface CourierField {
  key: CourierFieldKey;
  /** Mask the value and offer a show/hide toggle. */
  secret?: boolean;
  /** Render in the monospace face — off for free text such as an email. */
  mono?: boolean;
  /** Span both grid columns instead of one. */
  fullWidth?: boolean;
}

/** Everything needed to render one courier's credential card. */
export interface CourierProvider {
  id: CourierProviderId;
  emoji: string;
  /** Tint for the emoji badge, built from semantic tokens. */
  badgeClass: string;
  /** Form key holding this provider's enable switch. */
  enabledKey: CourierToggleKey;
  fields: CourierField[];
}

/** The subset of `CourierConfig` the page reads — those columns are nullable. */
export interface CourierConfigPayload {
  steadfastEnabled?: boolean | null;
  steadfastApiKey?: string | null;
  steadfastSecretKey?: string | null;
  pathaoEnabled?: boolean | null;
  pathaoClientId?: string | null;
  pathaoClientSecret?: string | null;
  pathaoUsername?: string | null;
  pathaoPassword?: string | null;
  pathaoStoreId?: string | null;
  redxEnabled?: boolean | null;
  redxApiToken?: string | null;
}
