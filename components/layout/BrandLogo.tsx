"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const LIGHT = "https://customer-assets.emergentagent.com/job_bot-connect-ai/artifacts/du1mqgw9_header-logo-black.png";
const DARK = "https://customer-assets.emergentagent.com/job_bot-connect-ai/artifacts/0b6shiak_header-logo-white.png";
const ICON = "https://customer-assets.emergentagent.com/job_bot-connect-ai/artifacts/ddksqwu8_no%20bg%20%281024%20x%201024%29.png";

export function BrandLogo({ className = "h-9", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={className} />; // Skeleton

  const currentTheme = theme === "system" ? resolvedTheme : theme;

  if (iconOnly) return <img src={ICON} alt="BokBok AI" className={className} />;
  return <img src={currentTheme === "dark" ? DARK : LIGHT} alt="BokBok AI" className={className} draggable={false} />;
}

export const DriplareIcon = ICON;
