import type { Locale } from "@/content/dictionaries";
import type { AccountType } from "@/lib/auth/account-context";
import { localizedPath, unifiedLoginPath, SITE_URL } from "@/lib/routes";

export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, SITE_URL);
    return parsed.origin === SITE_URL ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

export function destinationForAccount(accountType: AccountType, locale: Locale, requested?: string | null): string {
  const target = safeReturnPath(requested ?? null);
  if (accountType === "admin") return target && /^\/admin(?:\/|$)/.test(target) ? target : "/admin";
  if (accountType === "student") {
    const allowed = target && /^\/(?:tr\/(?:hesabim|ucretler|odeme)|en\/(?:account|pricing|checkout|payment))(?:\/|\?|#|$)/.test(target);
    return allowed ? target : localizedPath("studentAccount", locale);
  }
  return unifiedLoginPath(locale);
}

export function loginPathWithReturn(locale: Locale, requested?: string | null): string {
  const target = safeReturnPath(requested ?? null);
  return target ? `${unifiedLoginPath(locale)}?next=${encodeURIComponent(target)}` : unifiedLoginPath(locale);
}
