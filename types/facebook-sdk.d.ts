// Ambient type declarations for the Facebook JS SDK (window.FB).
// The SDK is loaded at runtime via <Script src="connect.facebook.net/.../sdk.js" />
// and shared across every integration surface (per-chatbot & global panels).

export type FacebookLoginResponse = {
  authResponse?: {
    accessToken: string;
    code?: string;
  };
};

export type FacebookSdk = {
  login: (
    callback: (response: FacebookLoginResponse) => void,
    options: Record<string, unknown>
  ) => void;
  init: (options: {
    appId: string;
    cookie: boolean;
    xfbml: boolean;
    version: string;
  }) => void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}
