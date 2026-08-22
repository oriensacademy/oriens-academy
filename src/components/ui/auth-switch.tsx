"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AuthSwitchProps {
  activeTab: "login" | "register";
  onChange: (tab: "login" | "register") => void;
  loginLabel?: string;
  registerLabel?: string;
  className?: string;
}

export function AuthSwitch({
  activeTab,
  onChange,
  loginLabel = "Oturum Aç",
  registerLabel = "Kayıt Ol",
  className,
}: AuthSwitchProps) {
  return (
    <div
      className={cn(
        "relative flex w-full rounded-2xl bg-surface-muted p-1 border border-border/80 shadow-xs",
        className
      )}
      role="tablist"
      aria-label="Authentication mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "login"}
        onClick={() => onChange("login")}
        className={cn(
          "relative z-10 flex flex-1 items-center justify-center rounded-xl py-2.5 text-xs font-semibold tracking-wide transition-all duration-200",
          activeTab === "login"
            ? "bg-white text-ink shadow-sm border border-border/60"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        {loginLabel}
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "register"}
        onClick={() => onChange("register")}
        className={cn(
          "relative z-10 flex flex-1 items-center justify-center rounded-xl py-2.5 text-xs font-semibold tracking-wide transition-all duration-200",
          activeTab === "register"
            ? "bg-white text-ink shadow-sm border border-border/60"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        {registerLabel}
      </button>
    </div>
  );
}

export default AuthSwitch;
