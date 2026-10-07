import { getSupabaseClient } from "@/lib/supabase/client";

// Giriş kaydı (Denetim > Girişler). Yalnız cihaz özeti ("Chrome · Windows")
// gönderilir; IP veya tam user-agent gönderilmez. Kayıt hatası girişi asla
// engellemez (ateşle ve unut).

export function loginDeviceSummary(userAgent: string): string {
  const ua = userAgent || "";
  const browser = /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
    : /Firefox\/|FxiOS/.test(ua) ? "Firefox"
    : /Chrome\/|CriOS/.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : "Tarayıcı";
  const os = /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return os ? `${browser} · ${os}` : browser;
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

export function recordLoginFailure(email: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (getSupabaseClient() as any).rpc("record_login_failure", { p_email: email, p_device: currentDevice() }).then(() => undefined, () => undefined);
  } catch {
    /* kayıt hatası girişi etkilemez */
  }
}
