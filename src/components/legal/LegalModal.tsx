"use client";

import { useEffect, useRef } from "react";
import { X, Shield, FileText } from "lucide-react";
import { LEGAL_DOCS, type LegalDocKey } from "@/config/legal";
import { formatCurrency } from "@/lib/format/currency";

export interface LegalOrderSnapshot {
  packageName: string;
  lessonCount: number;
  baseAmount: number;
  discountAmount?: number;
  couponCode?: string;
  finalAmount: number;
  currency: string;
  payerName?: string;
  payerEmail?: string;
  paymentMethod: "card" | "bank_transfer";
}

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  docKey: LegalDocKey;
  locale: "tr" | "en";
  orderSnapshot?: LegalOrderSnapshot;
}

export function LegalModal({
  isOpen,
  onClose,
  docKey,
  locale,
  orderSnapshot,
}: LegalModalProps) {
  const isTr = locale === "tr";
  const doc = LEGAL_DOCS[locale][docKey] || LEGAL_DOCS[locale].salesAgreement;
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function money(amount: number, currency = "TRY") {
    return formatCurrency(amount, { currency, locale });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Body */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-3xl border border-[#DDE4DC] bg-white shadow-2xl z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDE4DC] px-6 py-4 bg-[#F9FAF8] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  id="legal-modal-title"
                  className="font-heading text-base sm:text-lg font-bold text-[#10271B] truncate"
                >
                  {doc.title}
                </h2>
                <span className="hidden sm:inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  v{doc.version}
                </span>
              </div>
              <p className="text-[11px] text-[#68756C] truncate">
                Oriens Academy · {isTr ? "Son Güncelleme:" : "Last Updated:"} {doc.lastUpdated}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl text-[#68756C] hover:bg-[#EAEFEA] hover:text-[#10271B] transition-colors cursor-pointer"
            aria-label={isTr ? "Kapat" : "Close"}
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Document Body */}
        <div className="overflow-y-auto px-6 py-6 text-xs text-[#10271B] space-y-6">
          {/* Order Snapshot Box if on checkout and applicable */}
          {orderSnapshot && (docKey === "salesAgreement" || docKey === "preInformation") && (
            <div className="rounded-2xl border border-primary/30 bg-[#F5F8F4] p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-primary uppercase tracking-wider">
                <Shield className="size-3.5" />
                <span>{isTr ? "Sipariş ve Paket Bilgileri" : "Order & Package Summary"}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
                <div>
                  <span className="text-[#68756C] block">{isTr ? "Paket:" : "Package:"}</span>
                  <strong className="text-[#10271B]">{orderSnapshot.packageName} ({orderSnapshot.lessonCount} {isTr ? "Ders" : "Lessons"})</strong>
                </div>
                <div>
                  <span className="text-[#68756C] block">{isTr ? "Ödeme Yöntemi:" : "Payment Method:"}</span>
                  <strong className="text-[#10271B]">
                    {orderSnapshot.paymentMethod === "card"
                      ? isTr ? "Kredi / Banka Kartı (PayTR)" : "Credit / Debit Card (PayTR)"
                      : isTr ? "Banka Havalesi / EFT" : "Bank Transfer / EFT"}
                  </strong>
                </div>
                <div>
                  <span className="text-[#68756C] block">{isTr ? "Öğrenci / Alıcı:" : "Student / Buyer:"}</span>
                  <strong className="text-[#10271B]">{orderSnapshot.payerName || "—"} ({orderSnapshot.payerEmail || "—"})</strong>
                </div>
                <div>
                  <span className="text-[#68756C] block">{isTr ? "Toplam Tutar:" : "Total Amount:"}</span>
                  <strong className="text-sm font-bold text-[#10271B]">
                    {money(orderSnapshot.finalAmount, orderSnapshot.currency)}
                    {orderSnapshot.discountAmount ? (
                      <span className="text-[10px] text-emerald-700 font-normal ml-1.5">
                        ({isTr ? "Kupon:" : "Coupon:"} {orderSnapshot.couponCode} -{money(orderSnapshot.discountAmount, orderSnapshot.currency)})
                      </span>
                    ) : null}
                  </strong>
                </div>
              </div>
            </div>
          )}

          <p className="leading-relaxed text-sm text-[#10271B]/80 italic">
            {doc.intro}
          </p>

          <div className="divide-y divide-[#DDE4DC] space-y-4">
            {doc.sections.map((sec, idx) => (
              <div key={idx} className="pt-4 first:pt-0 space-y-2">
                <h3 className="font-heading text-sm sm:text-base font-bold text-[#10271B]">
                  {sec.heading}
                </h3>
                {sec.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="leading-relaxed text-xs sm:text-[13px] text-[#10271B]/85 whitespace-pre-line">
                    {p}
                  </p>
                ))}
                {sec.bullets && (
                  <ul className="list-disc pl-4 space-y-1 text-xs text-[#10271B]/85">
                    {sec.bullets.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#DDE4DC] px-6 py-3.5 bg-[#F9FAF8] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#68756C]">
            Oriens Academy Legal Center
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#10271B] px-5 py-2 text-xs font-semibold text-white hover:bg-[#203D2D] transition-colors cursor-pointer"
          >
            {isTr ? "Anladım ve Kapat" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
