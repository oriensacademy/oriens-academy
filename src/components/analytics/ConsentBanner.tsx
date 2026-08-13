"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/content/locale-context";
import {
  Cookie,
  ShieldCheck,
  Settings,
  X,
  Check,
  SlidersHorizontal,
} from "lucide-react";

export const CONSENT_STORAGE_KEY = "oriens_consent_v1";

export interface ConsentPreferences {
  analytics: boolean;
  advertising: boolean;
  version: number;
  updatedAt: string;
}

/**
 * Updates Google Consent Mode v2 signals via window.gtag.
 */
export function updateGoogleConsent(analytics: boolean, advertising: boolean) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("consent", "update", {
    analytics_storage: analytics ? "granted" : "denied",
    ad_storage: advertising ? "granted" : "denied",
    ad_user_data: advertising ? "granted" : "denied",
    ad_personalization: advertising ? "granted" : "denied",
  });
}

/**
 * Helper to trigger reopening the consent preferences modal from anywhere (e.g. footer).
 */
export function reopenConsentPreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("oriens_open_consent"));
}

export function ConsentBanner() {
  const locale = useLocale();
  const isTr = locale === "tr";

  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Preference Toggles
  const [analytics, setAnalytics] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    // Remove visible popup on localhost/dev
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      return;
    }

    let mounted = true;
    const timer = setTimeout(() => {
      if (typeof window === "undefined") return;

      const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (saved) {
        try {
          const parsed: ConsentPreferences = JSON.parse(saved);
          if (mounted) {
            setAnalytics(parsed.analytics);
            setAdvertising(parsed.advertising);
            updateGoogleConsent(parsed.analytics, parsed.advertising);
          }
        } catch {
          if (mounted) setVisible(true);
        }
      } else {
        if (mounted) setVisible(true);
      }
    }, 0);

    const handleReopen = () => {
      const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (saved) {
        try {
          const parsed: ConsentPreferences = JSON.parse(saved);
          setAnalytics(parsed.analytics);
          setAdvertising(parsed.advertising);
        } catch {
          // ignore
        }
      }
      setShowModal(true);
      setVisible(true);
    };

    window.addEventListener("oriens_open_consent", handleReopen);

    return () => {
      mounted = false;
      clearTimeout(timer);
      window.removeEventListener("oriens_open_consent", handleReopen);
    };
  }, []);

  const savePreferences = (analyticsVal: boolean, advertisingVal: boolean) => {
    const prefs: ConsentPreferences = {
      analytics: analyticsVal,
      advertising: advertisingVal,
      version: 1,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
    updateGoogleConsent(analyticsVal, advertisingVal);
    setVisible(false);
    setShowModal(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Bottom Sticky Banner */}
      {!showModal && (
        <div
          role="dialog"
          aria-label={isTr ? "Gizlilik ve Çerez Tercihleri" : "Privacy & Cookie Preferences"}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl rounded-2xl border border-stone-200 bg-white/95 p-5 shadow-2xl backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95 sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 space-y-1">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-[#819586] dark:bg-amber-950/80 dark:text-amber-300">
                <Cookie className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                  {isTr ? "Gizlilik ve Çerez Tercihleri" : "Privacy & Cookie Preferences"}
                </h3>
                <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 leading-relaxed max-w-2xl">
                  {isTr
                    ? "Sitemizde deneyiminizi geliştirmek ve performansı analiz etmek amacıyla gizlilik ilkelerine uygun çerezler kullanılmaktadır. Dilediğiniz zaman tercihlerinizi değiştirebilirsiniz."
                    : "We use privacy-safe cookies to enhance your experience and analyze platform performance. You can update your preferences at any time."}
                </p>
              </div>
            </div>

            {/* Banner Buttons */}
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => savePreferences(false, false)}
                className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
              >
                {isTr ? "Yalnızca Gerekli" : "Necessary Only"}
              </button>

              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
              >
                <SlidersHorizontal className="size-3.5 text-stone-500" />
                <span>{isTr ? "Tercihler" : "Preferences"}</span>
              </button>

              <button
                type="button"
                onClick={() => savePreferences(true, true)}
                className="rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
              >
                {isTr ? "Tümünü Kabul Et" : "Accept All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowModal(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900 z-10 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-4 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Settings className="size-5 text-[#819586]" />
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">
                  {isTr ? "Çerez ve Gizlilik Tercihleri" : "Cookie & Privacy Preferences"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex size-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Mandatory Category */}
              <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-800/40">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-stone-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{isTr ? "Zorunlu ve Güvenlik Çerezleri" : "Necessary & Security Cookies"}</span>
                  </div>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {isTr ? "Her Zaman Aktif" : "Always Active"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-stone-500 leading-relaxed">
                  {isTr
                    ? "Web sitesinin temel işlevselliği, oturum güvenliği ve form doğrulamaları (Turnstile) için zorunludur."
                    : "Essential for core platform security, session integrity, and Turnstile form protection."}
                </p>
              </div>

              {/* Analytics Category */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-stone-900 dark:text-white">
                      {isTr ? "Performans ve Analiz Çerezleri" : "Analytics & Performance Cookies"}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">analytics_storage</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={analytics}
                      onChange={(e) => setAnalytics(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10271B]"></div>
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-relaxed">
                  {isTr
                    ? "Sayfa ziyaretlerini anonim olarak analiz etmemizi ve hizmet kalitemizi artırmamızı sağlar (Google Analytics 4 & GTM)."
                    : "Allows us to anonymously measure page traffic and platform performance (GA4 & GTM)."}
                </p>
              </div>

              {/* Advertising Category */}
              <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-stone-900 dark:text-white">
                      {isTr ? "Pazarlama ve Reklam Çerezleri" : "Advertising & Marketing Cookies"}
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono">ad_storage, ad_user_data</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={advertising}
                      onChange={(e) => setAdvertising(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-stone-200 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10271B]"></div>
                  </label>
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 leading-relaxed">
                  {isTr
                    ? "Kişiselleştirilmiş akademik içerik ve kampanya bildirimleri sunmak amacıyla kullanılır."
                    : "Used for personalized academic offerings and marketing measurement."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => savePreferences(false, false)}
                className="text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-white"
              >
                {isTr ? "Tümünü Reddet" : "Reject Optional"}
              </button>

              <button
                type="button"
                onClick={() => savePreferences(analytics, advertising)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C]"
              >
                <Check className="size-4" />
                <span>{isTr ? "Tercihleri Kaydet" : "Save Preferences"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
