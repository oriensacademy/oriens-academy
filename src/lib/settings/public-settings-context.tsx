"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getPricingNavigationVisibility } from "@/lib/public-settings";

interface PublicSettingsContextType {
  showPricing: boolean;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const PublicSettingsContext = createContext<PublicSettingsContextType>({
  showPricing: true,
  loading: false,
  refreshSettings: async () => {},
});

export function PublicSettingsProvider({ children }: { children: React.ReactNode }) {
  const [showPricing, setShowPricing] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchSettings = useCallback(async () => {
    try {
      const visible = await getPricingNavigationVisibility();
      setShowPricing(visible);
    } catch {
      setShowPricing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const visible = await getPricingNavigationVisibility();
        if (active) setShowPricing(visible);
      } catch {
        if (active) setShowPricing(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    queueMicrotask(() => {
      void load();
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "oriens_dev_show_pricing") {
        void load();
      }
    };

    const handleCustomChange = () => {
      void load();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("oriens:settings_changed", handleCustomChange);

    return () => {
      active = false;
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("oriens:settings_changed", handleCustomChange);
    };
  }, []);

  return (
    <PublicSettingsContext.Provider
      value={{
        showPricing,
        loading,
        refreshSettings: fetchSettings,
      }}
    >
      {children}
    </PublicSettingsContext.Provider>
  );
}

export function usePublicSettings() {
  return useContext(PublicSettingsContext);
}
