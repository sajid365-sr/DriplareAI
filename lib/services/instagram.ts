import "server-only";

import { Prisma } from "@prisma/client";

const INSTAGRAM_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || "v20.0";
const INSTAGRAM_GRAPH_BASE_URL = `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}`;

type InstagramGraphApiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type InstagramTokenExchangeResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type InstagramAccountResponse = {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
};

type FacebookPageWithInstagramResponse = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: InstagramAccountResponse;
};

export type InstagramAccount = {
  id: string;
  username: string | null;
  name: string | null;
  profilePictureUrl: string | null;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
};

export type InstagramLongLivedToken = {
  accessToken: string;
  tokenType: string | null;
  expiresInSeconds: number | null;
  issuedAt: Date;
};

export class InstagramGraphApiError extends Error {
  code?: number;
  subcode?: number;
  type?: string;
  status?: number;

  constructor(message: string, details?: { code?: number; subcode?: number; type?: string; status?: number }) {
    super(message);
    this.name = "InstagramGraphApiError";
    this.code = details?.code;
    this.subcode = details?.subcode;
    this.type = details?.type;
    this.status = details?.status;
  }
}

function getMetaAppCredentials() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID || process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;

  if (!appId) {
    throw new Error("NEXT_PUBLIC_META_APP_ID is not configured.");
  }

  if (!appSecret) {
    throw new Error("META_APP_SECRET is not configured.");
  }

  return { appId, appSecret };
}

async function fetchInstagramJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const data = (await response.json()) as T & InstagramGraphApiErrorPayload;

  if (!response.ok || data?.error) {
    throw new InstagramGraphApiError(data?.error?.message || "Instagram Graph API request failed.", {
      code: data?.error?.code,
      subcode: data?.error?.error_subcode,
      type: data?.error?.type,
      status: response.status,
    });
  }

  return data as T;
}

export async function exchangeForLongLivedInstagramUserToken(shortLivedToken: string): Promise<InstagramLongLivedToken> {
  const { appId, appSecret } = getMetaAppCredentials();
  const issuedAt = new Date();
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const data = await fetchInstagramJson<InstagramTokenExchangeResponse>(
    `${INSTAGRAM_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`
  );

  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? null,
    expiresInSeconds: typeof data.expires_in === "number" ? data.expires_in : null,
    issuedAt,
  };
}

export type InstagramPageWithoutLinkedIg = {
  pageId: string;
  pageName: string;
};

export type InstagramConnectionCandidates = {
  accounts: InstagramAccount[];
  managedPageCount: number;
  pagesWithoutInstagram: InstagramPageWithoutLinkedIg[];
};

export async function fetchInstagramConnectionCandidates(
  userAccessToken: string
): Promise<InstagramConnectionCandidates> {
  const params = new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
  });

  const data = await fetchInstagramJson<{ data: FacebookPageWithInstagramResponse[] }>(
    `${INSTAGRAM_GRAPH_BASE_URL}/me/accounts?${params.toString()}`
  );

  const pages = data.data || [];

  const accounts = pages
    .filter((page) => page.instagram_business_account?.id && page.access_token)
    .map((page) => ({
      id: page.instagram_business_account?.id || "",
      username: page.instagram_business_account?.username ?? null,
      name: page.instagram_business_account?.name ?? null,
      profilePictureUrl: page.instagram_business_account?.profile_picture_url ?? null,
      pageId: page.id,
      pageName: page.name,
      pageAccessToken: page.access_token,
    }));

  const pagesWithoutInstagram = pages
    .filter((page) => page.access_token && !page.instagram_business_account?.id)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
    }));

  return {
    accounts,
    managedPageCount: pages.length,
    pagesWithoutInstagram,
  };
}

export async function fetchInstagramAccountsWithUserToken(userAccessToken: string): Promise<InstagramAccount[]> {
  const result = await fetchInstagramConnectionCandidates(userAccessToken);
  return result.accounts;
}

export function buildInstagramIntegrationConfig(options: {
  selectedAccount: InstagramAccount;
  longLivedUserToken: InstagramLongLivedToken;
}): Prisma.InputJsonObject {
  const { selectedAccount, longLivedUserToken } = options;
  const config: Record<string, Prisma.InputJsonValue> = {
    connectionSource: "facebook_page_linked_instagram",
    instagramAccountId: selectedAccount.id,
    pageId: selectedAccount.pageId,
    pageName: selectedAccount.pageName,
    pageAccessToken: selectedAccount.pageAccessToken,
    userAccessTokenLongLived: longLivedUserToken.accessToken,
    connectedAt: new Date().toISOString(),
    tokenIssuedAt: longLivedUserToken.issuedAt.toISOString(),
  };

  if (selectedAccount.username) {
    config.instagramUsername = selectedAccount.username;
  }

  if (selectedAccount.name) {
    config.instagramName = selectedAccount.name;
  }

  if (selectedAccount.profilePictureUrl) {
    config.instagramProfilePictureUrl = selectedAccount.profilePictureUrl;
  }

  if (longLivedUserToken.tokenType) {
    config.tokenType = longLivedUserToken.tokenType;
  }

  if (typeof longLivedUserToken.expiresInSeconds === "number") {
    config.tokenExpiresAt = new Date(
      longLivedUserToken.issuedAt.getTime() + longLivedUserToken.expiresInSeconds * 1000
    ).toISOString();
  }

  return config as Prisma.InputJsonObject;
}

/**
 * Subscribe a Facebook Page to the app for Instagram messaging webhook events.
 * This is required for Meta to deliver Instagram DM webhooks to our endpoint.
 */
export async function subscribeInstagramPageToApp(pageId: string, pageAccessToken: string) {
  const payload = {
    subscribed_fields: ["messages", "messaging_postbacks"],
    access_token: pageAccessToken,
  };

  return fetchInstagramJson<{ success?: boolean }>(
    `${INSTAGRAM_GRAPH_BASE_URL}/${pageId}/subscribed_apps`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export function isInstagramAuthError(error: unknown) {
  if (!(error instanceof InstagramGraphApiError)) {
    return false;
  }

  if (error.code === 190 || error.code === 10 || error.code === 200) {
    return true;
  }

  return /access token|permission|oauth|session|not authorized/i.test(error.message);
}
