import { getSupabaseClient } from "@/lib/supabase/client";

// Sepet / ödeme başlangıcı denetim kayıtları (admin denetim merkezi).
//
// Yalnızca olay türü, sepet kimliği ve paket kimlikleri gönderilir; paket adı,
// ders sayısı, fiyat, kupon ve tutar sunucuda (record_cart_event) yetkili
// kayıtlardan okunur. Kart, token veya kişisel veri gönderilmez. Çağrı
// beklenmez ve hata fırlatmaz: kayıt düşmese bile sepet / ödeme akışı aynen
// devam eder. Oturumu olmayan ziyaretçi için sunucu kaydı yazmaz.

export type CartAuditKind = "cart_item_added" | "cart_item_removed" | "cart_cleared" | "checkout_opened" | "checkout_started";
export type CartAuditSource = "pricing" | "cart" | "payment" | "guest_cart" | "payment_result";

export interface CartAuditOptions {
  studentId?: string | null;
  reference?: string | null;
  result?: "session_created" | "zero_payment" | "session_failed" | null;
  errorCode?: string | null;
  source?: CartAuditSource | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newCartId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // aşağıdaki yedeğe düş
  }
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function recordCartEvent(kind: CartAuditKind, cartId: string | null | undefined, packageIds: string[], options: CartAuditOptions = {}): void {
  if (typeof window === "undefined" || !cartId || !UUID.test(cartId)) return;
  const ids = Array.from(new Set(packageIds.map((id) => id.trim()).filter(Boolean))).slice(0, 20);
  if (!ids.length) return;
  const studentId = options.studentId && UUID.test(options.studentId) ? options.studentId : null;
  const errorCode = options.errorCode && /^[A-Z][A-Z_]{1,47}$/.test(options.errorCode) ? options.errorCode : null;
  try {
    // Yeni RPC tip üretiminden önce eklendi.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = getSupabaseClient() as any;
    void Promise.resolve(client.rpc("record_cart_event", {
      p_kind: kind,
      p_cart_id: cartId,
      p_package_ids: ids,
      p_student_id: studentId,
      p_reference: options.reference ? options.reference.slice(0, 64) : null,
      p_result: options.result ?? null,
      p_error_code: errorCode,
      p_source: options.source ?? null,
    })).catch(() => undefined);
  } catch {
    // Denetim kaydı akışı asla durdurmaz.
  }
}
