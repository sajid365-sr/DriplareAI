import "server-only";

import { Prisma } from "@prisma/client";

const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v20.0";
const WHATSAPP_GRAPH_BASE_URL = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`;

type WhatsAppGraphApiErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

type WhatsAppTokenExchangeResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type WhatsAppPhoneNumberResponse = {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
};

type WhatsAppBusinessAccountResponse = {
  id: string;
  name?: string;
  currency?: string;
  timezone_id?: string;
};

export type WhatsAppCredentialValidation = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  businessName: string | null;
  tokenType: string | null;
  expiresInSeconds: number | null;
  connectedAt: Date;
};

export class WhatsAppGraphApiError extends Error {
  code?: number;
  subcode?: number;
  type?: string;
  status?: number;

  constructor(message: string, details?: { code?: number; subcode?: number; type?: string; status?: number }) {
    super(message);
    this.name = "WhatsAppGraphApiError";
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

async function fetchWhatsAppJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  const data = (await response.json()) as T & WhatsAppGraphApiErrorPayload;

  if (!response.ok || data?.error) {
    throw new WhatsAppGraphApiError(data?.error?.message || "WhatsApp Graph API request failed.", {
      code: data?.error?.code,
      subcode: data?.error?.error_subcode,
      type: data?.error?.type,
      status: response.status,
    });
  }

  return data as T;
}

export async function exchangeWhatsAppEmbeddedSignupCode(code: string) {
  const { appId, appSecret } = getMetaAppCredentials();
  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    code,
  });

  return fetchWhatsAppJson<WhatsAppTokenExchangeResponse>(
    `${WHATSAPP_GRAPH_BASE_URL}/oauth/access_token?${params.toString()}`
  );
}

export async function fetchWhatsAppPhoneNumber(phoneNumberId: string, accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,display_phone_number,verified_name,quality_rating,code_verification_status",
  });

  return fetchWhatsAppJson<WhatsAppPhoneNumberResponse>(
    `${WHATSAPP_GRAPH_BASE_URL}/${phoneNumberId}?${params.toString()}`
  );
}

export async function fetchWhatsAppBusinessAccount(wabaId: string, accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: "id,name,currency,timezone_id",
  });

  return fetchWhatsAppJson<WhatsAppBusinessAccountResponse>(
    `${WHATSAPP_GRAPH_BASE_URL}/${wabaId}?${params.toString()}`
  );
}

export async function subscribeWhatsAppBusinessAccount(wabaId: string, accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken,
  });

  return fetchWhatsAppJson<{ success?: boolean }>(
    `${WHATSAPP_GRAPH_BASE_URL}/${wabaId}/subscribed_apps?${params.toString()}`,
    {
      method: "POST",
    }
  );
}

export async function validateWhatsAppCloudCredentials(options: {
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string | null;
  tokenType?: string | null;
  expiresInSeconds?: number | null;
}): Promise<WhatsAppCredentialValidation> {
  const phone = await fetchWhatsAppPhoneNumber(options.phoneNumberId, options.accessToken);
  let business: WhatsAppBusinessAccountResponse | null = null;

  if (options.wabaId) {
    business = await fetchWhatsAppBusinessAccount(options.wabaId, options.accessToken);
  }

  return {
    accessToken: options.accessToken,
    phoneNumberId: phone.id || options.phoneNumberId,
    wabaId: business?.id || options.wabaId || null,
    displayPhoneNumber: phone.display_phone_number ?? null,
    verifiedName: phone.verified_name ?? null,
    qualityRating: phone.quality_rating ?? null,
    businessName: business?.name ?? null,
    tokenType: options.tokenType ?? null,
    expiresInSeconds: options.expiresInSeconds ?? null,
    connectedAt: new Date(),
  };
}

export function buildWhatsAppIntegrationConfig(options: {
  validation: WhatsAppCredentialValidation;
  connectionSource: "embedded_signup" | "manual_cloud_api";
  webhookSubscribed?: boolean;
}): Prisma.InputJsonObject {
  const { validation, connectionSource, webhookSubscribed } = options;
  const config: Record<string, Prisma.InputJsonValue> = {
    connectionSource,
    accessToken: validation.accessToken,
    phoneNumberId: validation.phoneNumberId,
    connectedAt: validation.connectedAt.toISOString(),
  };

  if (validation.wabaId) {
    config.wabaId = validation.wabaId;
  }

  if (validation.displayPhoneNumber) {
    config.displayPhoneNumber = validation.displayPhoneNumber;
  }

  if (validation.verifiedName) {
    config.verifiedName = validation.verifiedName;
  }

  if (validation.businessName) {
    config.businessName = validation.businessName;
  }

  if (validation.qualityRating) {
    config.qualityRating = validation.qualityRating;
  }

  if (validation.tokenType) {
    config.tokenType = validation.tokenType;
  }

  if (typeof validation.expiresInSeconds === "number") {
    config.tokenExpiresAt = new Date(
      validation.connectedAt.getTime() + validation.expiresInSeconds * 1000
    ).toISOString();
  }

  if (webhookSubscribed) {
    config.webhookSubscribedAt = new Date().toISOString();
  }

  return config as Prisma.InputJsonObject;
}

export function isWhatsAppAuthError(error: unknown) {
  if (!(error instanceof WhatsAppGraphApiError)) {
    return false;
  }

  if (error.code === 190 || error.code === 10 || error.code === 200) {
    return true;
  }

  return /access token|permission|oauth|session|not authorized/i.test(error.message);
}
