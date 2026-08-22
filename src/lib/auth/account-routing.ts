import type { Locale } from "@/content/dictionaries";
import type { AccountType } from "@/lib/auth/account-context";
import { localizedPath, unifiedLoginPath } from "@/lib/routes";

export function safeReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const parsed = new URL(value, "https://oriens-academy.com");
    return parsed.origin === "https://oriens-academy.com" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

export function destinationForAccount(accountType: AccountType, locale: Locale, requested?: string | null): string {
  const target = safeReturnPath(requested ?? null);
  if (accountType === "admin") return target && /^\/admin(?:\/|$)/.test(target) ? target : "/admin";
  if (accountType === "student") {
    const allowed = target && /^\/(?:tr\/hesabim|en\/account)(?:\/|\?|#|$)/.test(target);
    return allowed ? target : localizedPath("studentAccount", locale);
  }
  return unifiedLoginPath(locale);
}

export function loginPathWithReturn(locale: Locale, requested?: string | null): string {
  const target = safeReturnPath(requested ?? null);
  return target ? `${unifiedLoginPath(locale)}?next=${encodeURIComponent(target)}` : unifiedLoginPath(locale);
}
