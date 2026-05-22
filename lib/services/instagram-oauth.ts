import "server-only";

import crypto from "crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

export type InstagramOAuthState = {
  chatbotId: string;
  userId: string;
  exp: number;
};

function getStateSecret() {
  const secret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!secret) {
    throw new Error("META_APP_SECRET is not configured.");
  }
  return secret;
}

export function getAppOrigin(req: Request): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export function getInstagramLoginRedirectUri(req: Request): string {
  const configured = process.env.INSTAGRAM_LOGIN_REDIRECT_URI;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `${getAppOrigin(req)}/api/integrations/instagram/oauth/callback`;
}

export function signInstagramOAuthState(payload: Omit<InstagramOAuthState, "exp">): string {
  const secret = getStateSecret();
  const body: InstagramOAuthState = {
    ...payload,
    exp: Date.now() + STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyInstagramOAuthState(state: string | null): InstagramOAuthState | null {
  if (!state) {
    return null;
  }

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const secret = getStateSecret();
  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as InstagramOAuthState;
    if (!payload.chatbotId || !payload.userId || !payload.exp) {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
