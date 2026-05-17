import "server-only";

import { Prisma } from "@prisma/client";

const FACEBOOK_GRAPH_VERSION = "v20.0";
const FACEBOOK_GRAPH_BASE_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}`;

type FacebookGraphApiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type FacebookTokenExchangeResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type FacebookPagePicture = {
  data?: {
    url?: string;
  };
};

type FacebookPageResponse = {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: FacebookPagePicture;
};

export type FacebookPage = {
  id: string;
  name: string;
  accessToken: string;
  category: string | null;
  pictureUrl: string | null;
};

export type FacebookLongLivedToken = {
  accessToken: string;
  tokenType: string | null;
  expiresInSeconds: number | null;
  issuedAt: Date;
};

export class FacebookGraphApiError extends Error {
  code?: number;
  subcode?: number;
  type?: string;
  status?: number;

  constructor(message: string, details?: { code?: number; subcode?: number; type?: string; status?: number }) {
    super(message);
    this.name = "FacebookGraphApiError";
    this.code = details?.code;
    this.subcode = details?.subcode;
    this.type = details?.type;
    this.status = details?.status;
  }
}

function getFacebookAppCredentials() {
  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId) {
    throw new Error("Facebook App ID is not configured.");
  }

  if (!appSecret) {
    throw new Error("FACEBOOK_APP_SECRET is not configured.");
  }

  return { appId, appSecret };
}

async function fetchFacebookJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const data = (await response.json()) as T & FacebookGraphApiErrorPayload;

  if (!response.ok || data?.error) {
    throw new FacebookGraphApiError(data?.error?.message || "Facebook Graph API request failed.", {
      code: data?.error?.code,
      subcode: data?.error?.error_subcode,
      type: data?.error?.type,
      status: response.status,
    });
  }

  return data as T;
}

export async function exchangeForLongLivedFacebookUserToken(
  shortLivedToken: string
): Promise<FacebookLongLivedToken> {
  const { appId, appSecret } = getFacebookAppCredentials();
  const issuedAt = new Date();

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const data = await fetchFacebookJson<FacebookTokenExchangeResponse>(
    `${FACEBOOK_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`
  );

  return {
    accessToken: data.access_token,
    tokenType: data.token_type ?? null,
    expiresInSeconds: typeof data.expires_in === "number" ? data.expires_in : null,
    issuedAt,
  };
}

export async function fetchFacebookPagesWithUserToken(userAccessToken: string): Promise<FacebookPage[]> {
  const params = new URLSearchParams({
    access_token: userAccessToken,
    fields: "id,name,access_token,category,picture{url}",
  });

  const data = await fetchFacebookJson<{ data: FacebookPageResponse[] }>(
    `${FACEBOOK_GRAPH_BASE_URL}/me/accounts?${params.toString()}`
  );

  return (data.data || []).map((page) => ({
    id: page.id,
    name: page.name,
    accessToken: page.access_token,
    category: page.category ?? null,
    pictureUrl: page.picture?.data?.url ?? null,
  }));
}

export async function subscribeFacebookPageToApp(pageId: string, pageAccessToken: string) {
  const payload = {
    subscribed_fields: ["messages", "messaging_postbacks"],
    access_token: pageAccessToken,
  };

  return fetchFacebookJson<{ success?: boolean }>(`${FACEBOOK_GRAPH_BASE_URL}/${pageId}/subscribed_apps`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function buildFacebookIntegrationConfig(options: {
  selectedPage: FacebookPage;
  longLivedUserToken: FacebookLongLivedToken;
  extraConfig?: Prisma.InputJsonObject;
}): Prisma.InputJsonObject {
  const { selectedPage, longLivedUserToken, extraConfig } = options;

  const config: Record<string, Prisma.InputJsonValue> = {
    pageId: selectedPage.id,
    pageName: selectedPage.name,
    pageToken: selectedPage.accessToken,
    userAccessTokenLongLived: longLivedUserToken.accessToken,
    tokenSource: "long_lived_user_exchange",
    connectedAt: new Date().toISOString(),
    tokenIssuedAt: longLivedUserToken.issuedAt.toISOString(),
  };

  if (longLivedUserToken.tokenType) {
    config.tokenType = longLivedUserToken.tokenType;
  }

  if (typeof longLivedUserToken.expiresInSeconds === "number") {
    config.tokenExpiresAt = new Date(
      longLivedUserToken.issuedAt.getTime() + longLivedUserToken.expiresInSeconds * 1000
    ).toISOString();
  }

  if (selectedPage.category) {
    config.pageCategory = selectedPage.category;
  }

  if (selectedPage.pictureUrl) {
    config.pagePictureUrl = selectedPage.pictureUrl;
  }

  return {
    ...config,
    ...(extraConfig || {}),
  } as Prisma.InputJsonObject;
}

export function isFacebookTokenExpiredError(error: unknown) {
  if (!(error instanceof FacebookGraphApiError)) {
    return false;
  }

  if (error.code === 190 && (error.subcode === 463 || error.subcode === 467)) {
    return true;
  }

  return /access token|session has expired|oauth/i.test(error.message);
}
