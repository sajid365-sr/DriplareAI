"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

export function ReferralTracker() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    // 1. Capture 'ref' from URL and save to localStorage
    const refCode = searchParams?.get("ref");
    if (refCode) {
      localStorage.setItem("driplare_referral_code", refCode);
    }
  }, [searchParams]);

  useEffect(() => {
    // 2. If user is signed in and we have a pending referral code, send to API
    if (isLoaded && isSignedIn && user) {
      const storedRef = localStorage.getItem("driplare_referral_code");
      if (storedRef) {
        // We only want to track this once. 
        // The backend will ignore if the user is already referred.
        fetch("/api/referral/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referralCode: storedRef }),
        })
          .then((res) => {
            if (res.ok) {
              // Successfully tracked, remove from local storage so we don't try again
              localStorage.removeItem("driplare_referral_code");
            }
          })
          .catch((err) => console.error("Failed to track referral:", err));
      }
    }
  }, [isLoaded, isSignedIn, user]);

  return null; // This component doesn't render anything
}
