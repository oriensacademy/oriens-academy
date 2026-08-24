"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { SiteSettingRow } from "@/lib/admin/settings";
import type { Json } from "@/types/database.types";
import { AdminWaveStatus } from "@/components/admin/AdminWaveStatus";
import { Wave } from "@/components/ui/wave";
import { Switch } from "@/components/ui/switch";
import {
  listAdminSiteSettings,
  updateAdminSiteSetting,
} from "@/lib/admin/settings";
import {
  Settings,
  Mail,
  Globe,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Navigation,
  Landmark,
} from "lucide-react";

export default function AdminSettingsPage() {
  return <SettingsContent />;
}

function SettingsContent() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Form State for Known Settings
  const [contactEmail, setContactEmail] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminLocale, setAdminLocale] = useState("tr");
  const [showPricing, setShowPricing] = useState(true);
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");

  // Track initial values for dirty state checking
  const [initialContactEmail, setInitialContactEmail] = useState("");
  const [initialBookingEmail, setInitialBookingEmail] = useState("");
  const [initialSupportEmail, setInitialSupportEmail] = useState("");
  const [initialPaymentEmail, setInitialPaymentEmail] = useState("");
  const [initialAdminEmail, setInitialAdminEmail] = useState("");
  const [initialAdminLocale, setInitialAdminLocale] = useState("tr");
  const [initialShowPricing, setInitialShowPricing] = useState(true);
  const [initialBankAccountHolder, setInitialBankAccountHolder] = useState("");
  const [initialBankName, setInitialBankName] = useState("");
  const [initialIban, setInitialIban] = useState("");

  const parseSettings = (rows: SiteSettingRow[]) => {
    rows.forEach((r) => {
      if (r.key === "notification.contact_email" && typeof r.value === "object" && r.value !== null && "email" in r.value) {
        const email = String((r.value as { email: string }).email);
        setContactEmail(email);
        setInitialContactEmail(email);
      }
      if (r.key === "notification.booking_email" && typeof r.value === "object" && r.value !== null && "email" in r.value) {
        const email = String((r.value as { email: string }).email);
        setBookingEmail(email);
        setInitialBookingEmail(email);
      }
      if (r.key === "notification.support_email" && typeof r.value === "object" && r.value !== null && "email" in r.value) {
        const email = String((r.value as { email: string }).email);
        setSupportEmail(email);
        setInitialSupportEmail(email);
      }
      if (r.key === "notification.payment_email" && typeof r.value === "object" && r.value !== null && "email" in r.value) {
        const email = String((r.value as { email: string }).email);
        setPaymentEmail(email);
        setInitialPaymentEmail(email);
      }
      if (r.key === "notification.admin_email" && typeof r.value === "object" && r.value !== null && "email" in r.value) {
        const email = String((r.value as { email: string }).email);
        setAdminEmail(email);
        setInitialAdminEmail(email);
      }
      if (r.key === "notification.admin_locale" && typeof r.value === "object" && r.value !== null && "locale" in r.value) {
        const loc = String((r.value as { locale: string }).locale);
        setAdminLocale(loc);
        setInitialAdminLocale(loc);
      }
      if (r.key === "navigation.show_pricing" && typeof r.value === "object" && r.value !== null && "visible" in r.value) {
        const visible = Boolean((r.value as { visible: boolean }).visible);
        setShowPricing(visible);
        setInitialShowPricing(visible);
      }
      if (["payment.bank_account_holder", "payment.bank_name", "payment.iban"].includes(r.key) && typeof r.value === "object" && r.value !== null && "value" in r.value) {
        const value = String((r.value as { value: string }).value ?? "");
        if (r.key === "payment.bank_account_holder") { setBankAccountHolder(value); setInitialBankAccountHolder(value); }
        if (r.key === "payment.bank_name") { setBankName(value); setInitialBankName(value); }
        if (r.key === "payment.iban") { setIban(value); setInitialIban(value); }
      }
    });
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await listAdminSiteSettings();
    setLoading(false);
    if (error) {
      setErrorMsg(error);
    } else {
      parseSettings(data);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);
      listAdminSiteSettings().then(({ data, error }) => {
        if (mounted) {
          setLoading(false);
          if (error) {
            setErrorMsg(error);
          } else {
            parseSettings(data);
          }
        }
      });
    }, 0);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleSaveSetting = async (key: string, valueObj: Json) => {
    setSavingKey(key);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { success, error } = await updateAdminSiteSetting(key, valueObj);
    setSavingKey(null);

    if (error) {
      setErrorMsg(error);
    } else if (success) {
      setSuccessMsg(`"${key}" ayarı başarıyla güncellendi.`);
      fetchSettings();
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="size-6 text-[#819586]" />
            <h1 className="text-xl font-bold tracking-tight text-[#10271B]">
              Site Ayarları / Site Settings
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Bildirim alıcı e-postalarını ve genel sistem konfigürasyonlarını yönetin.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-xs hover:bg-muted"
        >
          {loading ? <Wave className="h-3.5 w-7 text-[#819586]" aria-label="Yenileniyor" /> : <RefreshCw className="size-3.5" />}
          <span>Yenile</span>
        </button>
      </div>

      {/* Feedback Alerts */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={fetchSettings}
            className="font-semibold underline hover:text-red-950"
          >
            Tekrar Deneyin
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-white p-12 text-center">
          <AdminWaveStatus label="Yükleniyor…" className="text-sm font-medium text-[#819586]" />
          <p className="mt-3 text-xs text-muted-foreground">Site ayarları yükleniyor…</p>
        </div>
      )}

      {/* Settings Forms */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Details Section (Full Width) */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-white p-6 shadow-xs space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Landmark className="size-4 text-primary" />
                <span>Ödeme Bilgileri / Payment Details</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Banka havalesi alanları yalnızca gerçek bilgiler kaydedildiğinde herkese açık ödeme sayfasında gösterilir.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: "payment.bank_account_holder", label: "Hesap Sahibi / Account Holder", value: bankAccountHolder, setValue: setBankAccountHolder, initial: initialBankAccountHolder },
                { key: "payment.bank_name", label: "Banka / Bank", value: bankName, setValue: setBankName, initial: initialBankName },
                { key: "payment.iban", label: "IBAN", value: iban, setValue: (value: string) => setIban(value.toUpperCase().replace(/\s+/g, "")), initial: initialIban },
              ].map((field) => (
                <div key={field.key} className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-background-soft/50 p-4">
                  <label className="w-full text-xs font-bold text-foreground">
                    {field.label}
                    <span className="mt-1 block font-mono text-[10px] font-normal text-muted-foreground">{field.key}</span>
                    <input
                      value={field.value}
                      onChange={(event) => field.setValue(event.target.value)}
                      autoComplete="off"
                      className="mt-2 w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingKey === field.key || field.value === field.initial}
                    onClick={() => handleSaveSetting(field.key, { value: field.value.trim() })}
                    className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-ink px-3.5 text-xs font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingKey === field.key ? <Wave className="h-3.5 w-7 text-white" aria-label="Kaydediliyor" /> : <Save className="size-3.5" />}
                    <span>Kaydet</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Public Navigation Section */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-xs space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Navigation className="size-4 text-primary" />
                <span>Genel Menü / Public Navigation</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Yalnızca herkese açık site başlığındaki menü bağlantılarını kontrol eder.
              </p>
            </div>

            <div className="flex flex-col gap-4 rounded-lg border border-border bg-background-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 max-w-lg">
                <label htmlFor="pricing-navigation-switch" className="text-xs font-bold text-foreground">Ücretler Menüsü / Pricing Navigation</label>
                <div className="text-[11px] font-mono text-muted-foreground">navigation.show_pricing</div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Kapalı olduğunda Ücretler / Pricing bağlantısı TR ve EN genel menülerinden gizlenir.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="min-w-14 text-right text-xs font-semibold text-foreground">{showPricing ? "Açık" : "Kapalı"}</span>
                <Switch id="pricing-navigation-switch" checked={showPricing} onCheckedChange={setShowPricing} aria-label="Ücretler menüsü görünürlüğü" />
                <button
                  type="button"
                  disabled={savingKey === "navigation.show_pricing" || showPricing === initialShowPricing}
                  onClick={() => handleSaveSetting("navigation.show_pricing", { visible: showPricing })}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-xs font-semibold text-white hover:bg-forest disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingKey === "navigation.show_pricing" ? <Wave className="h-3.5 w-7 text-white" aria-label="Kaydediliyor" /> : <Save className="size-3.5" />}
                  <span>Kaydet</span>
                </button>
              </div>
            </div>
          </div>

          {/* Regional Preferences Section */}
          <div className="rounded-xl border border-border bg-white p-6 shadow-xs space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Globe className="size-4 text-[#819586]" />
                <span>Yönetici & Bölgesel Ayarlar / Regional Preferences</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sistem varsayılan yönetici bildirim ve panel dilini belirleyin.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 rounded-lg border border-border bg-background-soft/50">
              <div className="space-y-1">
                <div className="text-xs font-bold text-foreground">
                  Varsayılan Yönetici Bildirim Dili
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  notification.admin_locale
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={adminLocale}
                  onChange={(e) => setAdminLocale(e.target.value)}
                  className="w-44 rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                >
                  <option value="tr">Türkçe (TR)</option>
                  <option value="en">English (EN)</option>
                </select>
                <button
                  type="button"
                  disabled={savingKey === "notification.admin_locale" || adminLocale === initialAdminLocale}
                  onClick={() => handleSaveSetting("notification.admin_locale", { locale: adminLocale })}
                  className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
                >
                  {savingKey === "notification.admin_locale" ? (
                    <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  <span>Kaydet</span>
                </button>
              </div>
            </div>
          </div>

          {/* Notification Email Settings Section (Full Width) */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-white p-6 shadow-xs space-y-6">
            <div className="border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Mail className="size-4 text-[#10271B]" />
                <span>E-Posta Yönlendirme ve Bildirim Alıcıları / Workspace Email Routing</span>
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Google Workspace alias yapısına göre ayrıştırılmış bildirim alıcı e-posta adresleri.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* General Main Email (Reference / Read-Only) */}
              <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-border bg-background-soft/30">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>Genel / Birincil Posta Kutusu</span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Birincil</span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    info@oriens-academy.com
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Google Workspace OAuth ana kimliği ve genel iletişim e-posta adresi.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value="info@oriens-academy.com"
                    disabled
                    className="w-full rounded-lg border border-input bg-gray-100 px-3 py-2 text-xs text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Contact Email Setting */}
              <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-border bg-background-soft/50">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground">
                    İletişim & Danışmanlık Bildirim Alıcısı
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    notification.contact_email
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    İletişim formu ve hızlı iletişim bildirimleri bu adrese yönlendirilir.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="contact@oriens-academy.com"
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    disabled={savingKey === "notification.contact_email" || contactEmail === initialContactEmail}
                    onClick={() => handleSaveSetting("notification.contact_email", { email: contactEmail.trim() })}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
                  >
                    {savingKey === "notification.contact_email" ? (
                      <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>

              {/* Booking Email Setting */}
              <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-border bg-background-soft/50">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground">
                    Randevu Talebi Bildirim Alıcısı
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    notification.booking_email
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Yeni randevu talepleri ve takvim seans bildirimleri bu adrese gönderilir.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={bookingEmail}
                    onChange={(e) => setBookingEmail(e.target.value)}
                    placeholder="support@oriens-academy.com"
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    disabled={savingKey === "notification.booking_email" || bookingEmail === initialBookingEmail}
                    onClick={() => handleSaveSetting("notification.booking_email", { email: bookingEmail.trim() })}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
                  >
                    {savingKey === "notification.booking_email" ? (
                      <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>

              {/* Student Support Email Setting */}
              <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-border bg-background-soft/50">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground">
                    Öğrenci Destek & Ödev Bildirim Alıcısı
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    notification.support_email
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Ödev teslimleri, canlı ders ve öğrenci destek talepleri bu adrese yönlendirilir.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@oriens-academy.com"
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    disabled={savingKey === "notification.support_email" || supportEmail === initialSupportEmail}
                    onClick={() => handleSaveSetting("notification.support_email", { email: supportEmail.trim() })}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
                  >
                    {savingKey === "notification.support_email" ? (
                      <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>

              {/* Payment Email Setting */}
              <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-border bg-background-soft/50">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground">
                    Ödeme & Finans Bildirim Alıcısı
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    notification.payment_email
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Banka havalesi bildirimleri, başarılı ödemeler ve finansal uyarılar bu adrese iletilir.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={paymentEmail}
                    onChange={(e) => setPaymentEmail(e.target.value)}
                    placeholder="payments@oriens-academy.com"
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    disabled={savingKey === "notification.payment_email" || paymentEmail === initialPaymentEmail}
                    onClick={() => handleSaveSetting("notification.payment_email", { email: paymentEmail.trim() })}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
                  >
                    {savingKey === "notification.payment_email" ? (
                      <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>

              {/* Admin Security Email Setting */}
              <div className="flex flex-col justify-between gap-3 p-4 rounded-lg border border-border bg-background-soft/50">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground">
                    Yönetim & Güvenlik Bildirim Alıcısı
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground">
                    notification.admin_email
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Kritik sistem alarmları ve yönetici güvenlik bildirimleri bu adrese gider.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@oriens-academy.com"
                    className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
                  />
                  <button
                    type="button"
                    disabled={savingKey === "notification.admin_email" || adminEmail === initialAdminEmail}
                    onClick={() => handleSaveSetting("notification.admin_email", { email: adminEmail.trim() })}
                    className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
                  >
                    {savingKey === "notification.admin_email" ? (
                      <Wave className="h-3.5 w-7 text-amber-400" aria-label="Kaydediliyor" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    <span>Kaydet</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Account Security Section (Full Width) */}
          <div className="lg:col-span-2">
            <AccountSecuritySection />
          </div>

          {/* Security Banner (Full Width) */}
          <div className="lg:col-span-2 flex items-center gap-3 rounded-xl border border-border bg-background-soft p-4 text-xs text-muted-foreground">
            <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Lock className="size-3 text-muted-foreground" />
                <span>Korumalı Sistem Anahtarları</span>
              </div>
              <p className="mt-0.5 text-[11px]">
                API anahtarları, e-posta sağlayıcı kimlikleri, Turnstile secret key ve veritabanı şifreleri site ayarları panelinden hariç tutulmuştur ve yalnızca güvenli ortam değişkenlerinde (Supabase / Cloudflare env) saklanır.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSecuritySection() {
  const { user } = useAdminAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passLoading, setPassLoading] = useState(false);
  const [securityMsg, setSecurityMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || passLoading) return;
    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setSecurityMsg({ type: "error", text: "Yeni şifre en az 8 karakter; büyük harf, küçük harf, sayı ve sembol içermelidir." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMsg({ type: "error", text: "Şifreler eşleşmiyor." });
      return;
    }

    setPassLoading(true);
    setSecurityMsg(null);

    try {
      const supabase = getSupabaseClient();
      if (!user?.email) {
        setPassLoading(false);
        setSecurityMsg({ type: "error", text: "Yönetici oturumu doğrulanamadı." });
        return;
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (reauthError) {
        setPassLoading(false);
        setSecurityMsg({ type: "error", text: "Mevcut şifre doğrulanamadı." });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setPassLoading(false);
      if (error) {
        setSecurityMsg({ type: "error", text: error.message || "Şifre güncellenemedi." });
      } else {
        if (user?.id) {
          await supabase.from("audit_logs").insert({
            actor_user_id: user.id,
            action: "admin.password_change_completed",
            entity_type: "admin_auth",
            entity_id: user.id,
            metadata: { trigger: "voluntary_settings_change" },
          });
        }
        setSecurityMsg({ type: "success", text: "Şifreniz başarıyla değiştirildi." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPassLoading(false);
      setSecurityMsg({ type: "error", text: "Bir hata oluştu." });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-xs space-y-6">
      <div className="border-b border-border pb-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="size-4 text-[#819586]" />
          <span>Hesap Güvenliği / Account Security</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Yönetici hesabınızın giriş şifresini güvenli olarak değiştirin.
        </p>
      </div>

      {securityMsg && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            securityMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {securityMsg.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          <span>{securityMsg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-2 rounded-lg border border-border bg-background-soft/50 p-4">
          <div className="text-xs font-bold text-foreground">Yönetici E-postası</div>
          <div className="text-xs text-muted-foreground">{user?.email}</div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">Kurtarma hedefi sunucu tarafında sabittir. E-posta değişikliği bu panelden yapılmaz.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-3 rounded-lg border border-border bg-background-soft/50 p-4">
          <div className="text-xs font-bold text-foreground">Şifre Değiştir</div>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mevcut Şifre"
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Yeni Şifre"
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Yeni şifre tekrarı"
            className="w-full rounded-lg border border-input bg-white px-3 py-2 text-xs text-foreground"
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">En az 8 karakter; büyük harf, küçük harf, sayı ve sembol kullanın.</p>
          <button
            type="submit"
            disabled={passLoading || !currentPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10271B] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0D2A1C] disabled:opacity-40 cursor-pointer"
          >
            {passLoading ? <Wave className="h-3.5 w-7 text-white" aria-label="Şifre güncelleniyor" /> : <Lock className="size-3.5" />}
            <span>Şifreyi Güncelle</span>
          </button>
        </form>
      </div>
    </div>
  );
}
