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
        "relative grid h-[54px] w-full grid-cols-2 rounded-[14px] border border-border bg-surface-muted p-1",
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
          "relative z-10 flex h-11 items-center justify-center rounded-[10px] text-[15px] font-semibold transition-all duration-200",
          activeTab === "login"
            ? "bg-white text-ink shadow-sm"
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
          "relative z-10 flex h-11 items-center justify-center rounded-[10px] text-[15px] font-semibold transition-all duration-200",
          activeTab === "register"
            ? "bg-white text-ink shadow-sm"
            : "text-muted-foreground hover:text-ink"
        )}
      >
        {registerLabel}
      </button>
    </div>
  );
}

export default AuthSwitch;
