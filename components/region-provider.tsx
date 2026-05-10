"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type Region, type RegionConfig, getRegionFromCookie, getRegionConfig } from "@/lib/region";

interface RegionContextValue {
  region: Region;
  config: RegionConfig;
}

const RegionContext = createContext<RegionContextValue>({
  region: "bd",
  config: getRegionConfig("bd"),
});

export function RegionProvider({ children, initialRegion = "bd" }: { children: React.ReactNode, initialRegion?: Region }) {
  const [region, setRegion] = useState<Region>(initialRegion);

  useEffect(() => {
    setRegion(getRegionFromCookie());
  }, []);

  const config = getRegionConfig(region);

  return (
    <RegionContext.Provider value={{ region, config }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
