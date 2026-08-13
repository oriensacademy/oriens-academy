"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { AlertCircle } from "lucide-react";

const CLOUDFLARE_TEST_SITE_KEY = "1x00000000000000000000BB";

export interface TurnstileWidgetRef {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  action?: string;
  theme?: "light" | "dark" | "auto";
  locale?: "tr" | "en";
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          action?: string;
          theme?: "light" | "dark" | "auto";
          language?: string;
          appearance?: "always" | "execute" | "interaction-only";
          size?: "normal" | "compact" | "flexible" | "invisible";
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      onVerify,
      onExpire,
      onError,
      action = "form_submit",
      theme = "auto",
      locale = "tr",
      className = "",
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [isMissingConfig, setIsMissingConfig] = useState(false);

    const envSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const isDev = process.env.NODE_ENV === "development";

    const activeSiteKey = envSiteKey || (isDev ? CLOUDFLARE_TEST_SITE_KEY : "");

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.warn("[TurnstileWidget] Reset error:", e);
          }
        }
      },
    }));

    useEffect(() => {
      if (!envSiteKey) {
        if (isDev) {
          // Local development uses Cloudflare's official non-interactive test key.
        } else {
          setIsMissingConfig(true);
          return;
        }
      }

      if (window.turnstile) {
        setScriptLoaded(true);
        return;
      }

      const existingScript = document.getElementById("cf-turnstile-script");
      if (existingScript) {
        const checkInterval = setInterval(() => {
          if (window.turnstile) {
            setScriptLoaded(true);
            clearInterval(checkInterval);
          }
        }, 100);
        return () => clearInterval(checkInterval);
      }

      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setScriptLoaded(true);
      };

      script.onerror = () => {
        console.error("[TurnstileWidget] Failed to load Cloudflare Turnstile script.");
        if (onError) onError();
      };

      document.head.appendChild(script);
    }, [envSiteKey, isDev, onError]);

    useEffect(() => {
      if (!scriptLoaded || !containerRef.current || !activeSiteKey || !window.turnstile) {
        return;
      }

      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup errors
        }
        widgetIdRef.current = null;
      }

      try {
        const isInvisibleTestKey = activeSiteKey === "1x00000000000000000000BB";
        const id = window.turnstile.render(containerRef.current, {
          sitekey: activeSiteKey,
          action,
          theme,
          language: locale === "tr" ? "tr" : "en",
          appearance: isInvisibleTestKey ? "execute" : "interaction-only",
          size: isInvisibleTestKey ? "invisible" : "flexible",
          callback: (token: string) => {
            onVerify(token);
          },
          "expired-callback": () => {
            if (onExpire) onExpire();
          },
          "error-callback": () => {
            if (onError) onError();
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error("[TurnstileWidget] Render error:", err);
      }

      return () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore cleanup errors
          }
          widgetIdRef.current = null;
        }
      };
    }, [scriptLoaded, activeSiteKey, action, theme, locale, onVerify, onExpire, onError]);

    if (isMissingConfig) {
      return (
        <div
          role="alert"
          className={`border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 ${className}`}
        >
          <div className="flex items-center gap-2 font-medium">
            <AlertCircle className="size-4 shrink-0" />
            <span>
              {locale === "tr"
                ? "Güvenlik doğrulama anahtarı eksik (NEXT_PUBLIC_TURNSTILE_SITE_KEY)."
                : "Security verification key unconfigured (NEXT_PUBLIC_TURNSTILE_SITE_KEY)."}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className={`my-2 flex min-h-0 flex-col items-start ${className}`}>
        <div
          ref={containerRef}
          aria-label={
            locale === "tr"
              ? "Cloudflare Turnstile Güvenlik Doğrulaması"
              : "Cloudflare Turnstile Security Verification"
          }
        />
      </div>
    );
  }
);
