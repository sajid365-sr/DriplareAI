"use client";

import Script from "next/script";

interface FacebookSDKProps {
    facebookAppId: string;
    metaAppId: string;
}

/**
 * Facebook JS SDK loader — required for Meta OAuth flows
 * (Facebook Page, Instagram, WhatsApp Embedded Signup).
 * Loaded via `lazyOnload` strategy to avoid blocking initial render.
 */
export function FacebookSDK({ facebookAppId, metaAppId }: FacebookSDKProps) {
    return (
        <Script
            src="https://connect.facebook.net/en_US/sdk.js"
            strategy="lazyOnload"
            onLoad={() => {
                if (!facebookAppId) {
                    console.error("Facebook SDK loaded but NEXT_PUBLIC_FACEBOOK_APP_ID is missing.");
                    return;
                }
                if (window.FB) {
                    window.FB.init({
                        appId: metaAppId || facebookAppId,
                        cookie: true,
                        xfbml: true,
                        version: "v20.0",
                    });
                }
            }}
        />
    );
}
