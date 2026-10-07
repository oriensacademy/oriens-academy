"use client";

import { useSyncExternalStore } from "react";
import { CONTACT } from "@/config/contact";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database.types";

// Ayarlar > İletişim bilgileri. Kanonik kaynak: site_settings "contact.public"
// (herkese açık satır, yalnız admin günceller). Satır okunamazsa src/config/contact.ts
// değerleri kullanılır. localStorage kanonik değildir ve kullanılmaz.

export const CONTACT_SETTINGS_KEY = "contact.public";

export type ContactSettings = { whatsapp: string; landline: string; email: string; address: string };

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  whatsapp: "+90 544 293 90 40",
  landline: "+90 850 304 04 67",
  email: CONTACT.email,
  address: CONTACT.businessAddress.tr,
};

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseContactSettings(value: unknown): ContactSettings {
  const v = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const email = text(v.email, 160);
  return {
    whatsapp: text(v.whatsapp, 40) || DEFAULT_CONTACT_SETTINGS.whatsapp,
    landline: text(v.landline, 40) || DEFAULT_CONTACT_SETTINGS.landline,
    email: EMAIL_RE.test(email) ? email : DEFAULT_CONTACT_SETTINGS.email,
    address: text(v.address, 300) || DEFAULT_CONTACT_SETTINGS.address,
  };
}

export function validateContactSettings(input: ContactSettings): { field: keyof ContactSettings; message: string } | null {
  if (!EMAIL_RE.test(input.email.trim())) return { field: "email", message: "Geçerli bir e-posta adresi yazın" };
  if (input.whatsapp.replace(/\D/g, "").length < 10) return { field: "whatsapp", message: "WhatsApp numarasını eksiksiz yazın" };
  if (input.landline.replace(/\D/g, "").length < 10) return { field: "landline", message: "Sabit telefonu eksiksiz yazın" };
  if (input.address.trim().length < 10) return { field: "address", message: "Adresi yazın" };
  return null;
}

function intlDigits(value: string) {
  let d = value.replace(/\D/g, "");
  if (d.length === 10) d = `90${d}`;
  else if (d.length === 11 && d.startsWith("0")) d = `9${d}`;
  return d;
}

type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? Widen<U>[] : T extends object ? { -readonly [K in keyof T]: Widen<T[K]> } : T;

/** src/config/contact.ts CONTACT ile aynı alanlar; değerler Ayarlar > İletişim kaydından. */
export type SiteContactView = Widen<typeof CONTACT> & { whatsappDigits: string };

/** Sitenin iletişim alanları için görünüm. Varsayılan değerlerde bugünkü gösterim aynen korunur. */
export function toSiteContactView(settings: ContactSettings): SiteContactView {
  const wa = intlDigits(settings.whatsapp);
  const tel = intlDigits(settings.landline);
  const defaultWa = wa === intlDigits(DEFAULT_CONTACT_SETTINGS.whatsapp);
  const defaultTel = tel === intlDigits(DEFAULT_CONTACT_SETTINGS.landline);
  const defaultAddress = settings.address.replace(/\s+/g, " ").trim() === DEFAULT_CONTACT_SETTINGS.address;
  const lines = settings.address.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const single = lines.join(", ");
  const whatsappDisplay = defaultWa ? CONTACT.whatsappDisplay : settings.whatsapp;
  const whatsappHref = `https://wa.me/${wa}`;
  const landlineDisplay = defaultTel ? CONTACT.landlineDisplay : settings.landline;
  const landlineHref = defaultTel ? CONTACT.landlineHref : `tel:+${tel}`;
  return {
    ...CONTACT,
    email: settings.email,
    emailHref: `mailto:${settings.email}`,
    contactEmail: settings.email,
    supportEmail: settings.email,
    paymentsEmail: settings.email,
    whatsappDisplay,
    whatsappHref,
    whatsappDigits: wa,
    mobileDisplay: whatsappDisplay,
    mobileHref: whatsappHref,
    phoneDisplay: landlineDisplay,
    phoneHref: landlineHref,
    landlineDisplay,
    landlineHref,
    corporatePhoneDisplay: landlineDisplay,
    corporatePhoneHref: landlineHref,
    businessAddress: defaultAddress ? { ...CONTACT.businessAddress } : { tr: single, en: single },
    businessAddressLines: defaultAddress
      ? { tr: [...CONTACT.businessAddressLines.tr], en: [...CONTACT.businessAddressLines.en] }
      : { tr: lines, en: lines },
  };
}

// --- Sitede tek okuma (sayfa başına bir istek) --------------------------------

let current: SiteContactView = toSiteContactView(DEFAULT_CONTACT_SETTINGS);
const DEFAULT_VIEW = current;
const listeners = new Set<() => void>();
let requested = false;

function publish(settings: ContactSettings) {
  current = toSiteContactView(settings);
  listeners.forEach((listener) => listener());
}

export async function fetchContactSettings(): Promise<ContactSettings> {
  try {
    const { data, error } = await getSupabaseClient()
      .from("site_settings")
      .select("value")
      .eq("key", CONTACT_SETTINGS_KEY)
      .eq("is_public", true)
      .maybeSingle();
    if (error || !data) return DEFAULT_CONTACT_SETTINGS;
    return parseContactSettings(data.value);
  } catch {
    return DEFAULT_CONTACT_SETTINGS;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    void fetchContactSettings().then(publish);
  }
  return () => listeners.delete(listener);
}

/** Sitenin iletişim bilgileri (Ayarlar > İletişim). İlk çizimde varsayılan, ardından sunucu değeri. */
export function useSiteContact(): SiteContactView {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_VIEW);
}

// --- Panel: kaydet ----------------------------------------------------------

export async function saveContactSettings(input: ContactSettings): Promise<{ ok: true; value: ContactSettings } | { ok: false; error: string }> {
  const invalid = validateContactSettings(input);
  if (invalid) return { ok: false, error: invalid.message };
  const value: ContactSettings = {
    whatsapp: input.whatsapp.trim(),
    landline: input.landline.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
  };
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("site_settings")
    .update({ value: value as unknown as Json, updated_at: new Date().toISOString(), updated_by: userData.user?.id || null })
    .eq("key", CONTACT_SETTINGS_KEY)
    .select("key");
  if (error) return { ok: false, error: "İletişim bilgileri kaydedilemedi." };
  if (!data?.length) return { ok: false, error: "İletişim kaydı bulunamadı. Lütfen sistem yöneticisine bildirin." };
  await supabase.from("audit_logs").insert({
    actor_user_id: userData.user?.id || null,
    action: "admin.settings.updated",
    entity_type: "site_setting",
    entity_id: CONTACT_SETTINGS_KEY,
    metadata: { key: CONTACT_SETTINGS_KEY, fields: Object.keys(value) },
  });
  publish(value);
  return { ok: true, value };
}
