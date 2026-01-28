"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

export type TopBarStep = "intake" | "candidates" | "drafts" | "review";
export type TopBarActionVariant = "primary" | "secondary" | "ghost";

export type TopBarAction =
  | {
      kind: "link";
      label: string;
      href: string;
      variant?: TopBarActionVariant;
      disabled?: boolean;
      confirmText?: string;
    }
  | {
      kind: "button";
      label: string;
      onClick: () => void;
      variant?: TopBarActionVariant;
      disabled?: boolean;
      confirmText?: string;
    };

export type TopBarConfig = {
  currentStep: TopBarStep;
  disabledAll: boolean;
  actions: TopBarAction[];
};

const DEFAULT_CONFIG: TopBarConfig = {
  currentStep: "intake",
  disabledAll: false,
  actions: [],
};

type TopBarContextValue = {
  config: TopBarConfig;
  setTopBarConfig: (config: TopBarConfig) => void;
  patchTopBarConfig: (partial: Partial<TopBarConfig>) => void;
  resetTopBarConfig: () => void;
  defaultConfig: TopBarConfig;
};

const TopBarContext = createContext<TopBarContextValue | null>(null);

export function TopBarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [config, setConfig] = useState<TopBarConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    setConfig(DEFAULT_CONFIG);
  }, [pathname]);

  const value = useMemo<TopBarContextValue>(() => {
    return {
      config,
      setTopBarConfig: setConfig,
      patchTopBarConfig: (partial) => setConfig((prev) => ({ ...prev, ...partial })),
      resetTopBarConfig: () => setConfig(DEFAULT_CONFIG),
      defaultConfig: DEFAULT_CONFIG,
    };
  }, [config]);

  return <TopBarContext.Provider value={value}>{children}</TopBarContext.Provider>;
}

export function useTopBar() {
  const ctx = useContext(TopBarContext);
  if (!ctx) throw new Error("useTopBar must be used within TopBarProvider");
  return ctx;
}
