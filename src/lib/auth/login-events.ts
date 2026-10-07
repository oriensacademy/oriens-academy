import { summarizeUserAgent } from "@/lib/admin/audit-catalog";
import { getSupabaseClient } from "@/lib/supabase/client";

// Giriş kaydı (Denetim > Girişler). Yalnız cihaz özeti ("Chrome 140 · Windows · Masaüstü")
// gönderilir; IP veya tam user-agent gönderilmez. Kayıt hatası girişi asla
// engellemez (ateşle ve unut).

export function loginDeviceSummary(userAgent: string): string {
  return summarizeUserAgent(userAgent);
}

function currentDevice() {
  return typeof navigator === "undefined" ? "" : loginDeviceSummary(navigator.userAgent);
}

export function recordLoginSuccess(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (getSupabaseClient() as any).rpc("record_login_success", { p_device: currentDevice() }).then(() => undefined, () => undefined);
  } catch {
    /* kayıt hatası girişi etkilemez */
  }
}

/**
 * Çıkış / şifre değişikliği kaydı (Denetim > Sistem olayları). Oturum hâlâ
 * açıkken çağrılmalıdır. En fazla 1,5 sn beklenir; kayıt hatası akışı engellemez.
 */
export async function recordAccountEvent(kind: "logout" | "password_changed"): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (getSupabaseClient() as any).rpc("record_account_event", { p_kind: kind, p_device: currentDevice() }).then(() => undefined, () => undefined);
    await Promise.race([call, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
  } catch {
    /* kayıt hatası akışı etkilemez */
  }
}

export type LoginFailureReason = "invalid_credentials" | "email_not_confirmed" | "user_banned" | "rate_limited";

/** Supabase hata kodunu kaydedilecek başarısızlık nedenine çevirir; diğer hatalar kaydedilmez. */
export function loginFailureReason(code: string | undefined): LoginFailureReason | null {
  switch (code) {
    case "invalid_credentials":
    case "email_not_confirmed":
    case "user_banned":
      return code;
    case "over_request_rate_limit":
      return "rate_limited";
    default:
      return null;
  }
}

export function recordLoginFailure(email: string, reason: LoginFailureReason = "invalid_credentials"): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (getSupabaseClient() as any).rpc("record_login_failure", { p_email: email, p_device: currentDevice(), p_reason: reason }).then(() => undefined, () => undefined);
  } catch {
    /* kayıt hatası girişi etkilemez */
  }
}
