"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import Image from "next/image";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "h-9 w-auto" }: BrandLogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydratation mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = !mounted
    ? "/header-logo-black.png"
    : resolvedTheme === "dark"
    ? "/header-logo-white.png"
    : "/header-logo-black.png";

  return (
    <Image
      src={logoSrc}
      alt="Driplare"
      height={36}
      width={120}
      className={`${className} object-contain`}
      priority
    />
  );
}

// Keep export for landing page demo
export const REMOVEDIcon = "/header-logo-black.png";
export default BrandLogo;
