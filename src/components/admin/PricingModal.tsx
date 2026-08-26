"use client";

import { useState, useEffect } from "react";
import type { PricingPackageRow, BillingBasis } from "@/lib/admin/pricing";
import {
  createAdminPricingPackage,
  updateAdminPricingPackage,
} from "@/lib/admin/pricing";
import {
  X,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Wave } from "@/components/ui/wave";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingPackage: PricingPackageRow | null;
}

export function PricingModal({
  isOpen,
  onClose,
  onSaved,
  editingPackage,
}: PricingModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [id, setId] = useState("");
  const [priceAmount, setPriceAmount] = useState<string>("");
  const [currency, setCurrency] = useState("TRY");
  const [billingBasis, setBillingBasis] = useState<BillingBasis>("session");
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [nameTr, setNameTr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descriptionTr, setDescriptionTr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [lessonCount, setLessonCount] = useState("1");
  const [discount, setDiscount] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [oldTotal, setOldTotal] = useState("");
  const [badgeTr, setBadgeTr] = useState("");
  const [badgeEn, setBadgeEn] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingPackage) {
        setId(editingPackage.id);
        const effectivePrice = editingPackage.current_total ?? editingPackage.price_amount;
        setPriceAmount(effectivePrice !== null ? String(effectivePrice) : "");
        setCurrency(editingPackage.currency || "TRY");
        setBillingBasis(editingPackage.billing_basis as BillingBasis);
        setDisplayOrder(editingPackage.display_order || 0);
        setNameTr(editingPackage.name_tr || "");
        setNameEn(editingPackage.name_en || "");
        setDescriptionTr(editingPackage.description_tr || "");
        setDescriptionEn(editingPackage.description_en || "");
        setLessonCount(editingPackage.lesson_count === null ? "1" : String(editingPackage.lesson_count));
        setDiscount(editingPackage.discount_percentage === null ? "" : String(editingPackage.discount_percentage));
        setUnitPrice(editingPackage.unit_price === null ? "" : String(editingPackage.unit_price));
        setOldTotal(editingPackage.old_total === null ? "" : String(editingPackage.old_total));
        setBadgeTr(editingPackage.badge_tr || "");
        setBadgeEn(editingPackage.badge_en || "");
      } else {
        setId("");
        setPriceAmount("");
        setCurrency("TRY");
        setBillingBasis("session");
        setDisplayOrder(0);
        setNameTr("");
        setNameEn("");
        setDescriptionTr("");
        setDescriptionEn("");
        setLessonCount("1");
        setDiscount("");
        setUnitPrice("");
        setOldTotal("");
        setBadgeTr("");
        setBadgeEn("");
      }
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [editingPackage, isOpen]);

  if (!isOpen) return null;

  // Auto-calculate unit price when price or lesson count changes
  const handlePriceChange = (val: string) => {
    setPriceAmount(val);
    const numPrice = parseFloat(val);
    const count = parseInt(lessonCount, 10) || 1;
    if (!isNaN(numPrice) && numPrice > 0 && count > 0) {
      setUnitPrice(String(Math.round(numPrice / count)));
    }
  };

  const handleLessonCountChange = (val: string) => {
    setLessonCount(val);
    const count = parseInt(val, 10) || 1;
    const numPrice = parseFloat(priceAmount);
    if (!isNaN(numPrice) && numPrice > 0 && count > 0) {
      setUnitPrice(String(Math.round(numPrice / count)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const parsedPrice = priceAmount.trim() !== "" ? parseFloat(priceAmount) : null;
    const parsedLessons = parseInt(lessonCount, 10) || 1;
    const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));

    if (parsedPrice === null || isNaN(parsedPrice) || parsedPrice < 0) {
      setErrorMsg("Fiyat tutarı geçerli ve pozitif bir sayı olmalıdır.");
      setSubmitting(false);
      return;
    }

    const calculatedUnitPrice = numberOrNull(unitPrice) ?? (parsedLessons > 0 ? Math.round(parsedPrice / parsedLessons) : parsedPrice);
    const calculatedOldTotal = numberOrNull(oldTotal);
    const calculatedDiscount = numberOrNull(discount);

    const details = {
      name_tr: nameTr.trim() || null,
      name_en: nameEn.trim() || null,
      description_tr: descriptionTr.trim() || null,
      description_en: descriptionEn.trim() || null,
      lesson_count: parsedLessons,
      discount_percentage: calculatedDiscount,
      unit_price: calculatedUnitPrice,
      old_total: calculatedOldTotal,
      current_total: parsedPrice,
      badge_tr: badgeTr.trim() || null,
      badge_en: badgeEn.trim() || null,
      purchase_mode: "purchasable" as const,
    };

    if (editingPackage) {
      const { success, error } = await updateAdminPricingPackage(editingPackage.id, {
        price_amount: parsedPrice,
        currency,
        billing_basis: billingBasis,
        active: true,
        display_order: displayOrder,
        ...details,
      });

      setSubmitting(false);

      if (error) {
        setErrorMsg(error);
      } else if (success) {
        setSuccessMsg("Fiyat paketi başarıyla güncellendi.");
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      }
    } else {
      const { error } = await createAdminPricingPackage({
        id,
        price_amount: parsedPrice,
        currency,
        billing_basis: billingBasis,
        active: true,
        display_order: displayOrder,
        ...details,
      });

      setSubmitting(false);

      if (error) {
        setErrorMsg(error);
      } else {
        setSuccessMsg("Yeni fiyat paketi başarıyla oluşturuldu.");
        setTimeout(() => {
          onSaved();
          onClose();
        }, 800);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-forest/35 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl space-y-5 overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="size-5 text-[#819586]" />
            <h2 className="text-sm font-bold text-foreground">
              {editingPackage ? "Fiyat Paketini Düzenle" : "Yeni Fiyat Paketi Ekle"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Paket Kimliği / ID (Slug)
            </label>
            <input
              type="text"
              required
              disabled={!!editingPackage}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="single / package10"
              className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground placeholder:text-muted-foreground disabled:bg-muted disabled:opacity-60"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextField label="Paket Adı (TR)" value={nameTr} onChange={setNameTr} required />
            <AdminTextField label="Package Name (EN)" value={nameEn} onChange={setNameEn} required />
            <AdminTextField label="Açıklama (TR)" value={descriptionTr} onChange={setDescriptionTr} />
            <AdminTextField label="Description (EN)" value={descriptionEn} onChange={setDescriptionEn} />
          </div>

          {/* Primary Price and Lesson Count */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Paket Satış Fiyatı (TL) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={priceAmount}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="Örn: 27000"
                className="w-full rounded-lg border border-input bg-white p-2 text-xs font-bold text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Ders Adedi (Saat) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={lessonCount}
                onChange={(e) => handleLessonCountChange(e.target.value)}
                placeholder="Örn: 10"
                className="w-full rounded-lg border border-input bg-white p-2 text-xs font-semibold text-foreground"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Birim Ders Ücreti (TL)
              </label>
              <input
                type="number"
                min="0"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Otomatik hesaplanır"
                className="w-full rounded-lg border border-input bg-surface-muted/50 p-2 text-xs text-foreground"
              />
            </div>
          </div>

          {/* Discounts & Comparison Info */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AdminNumberField label="İndirimsiz Liste Fiyatı (Eski Fiyat)" value={oldTotal} onChange={setOldTotal} />
            <AdminNumberField label="İndirim Oranı (%)" value={discount} onChange={setDiscount} />
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Sıralama (Display Order)
              </label>
              <input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
              />
            </div>
          </div>

          {/* Presentation Badges */}
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminTextField label="Rozet (TR) (Örn: En Çok Tercih Edilen)" value={badgeTr} onChange={setBadgeTr} />
            <AdminTextField label="Badge (EN) (e.g. Most Popular)" value={badgeEn} onChange={setBadgeEn} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-input bg-white px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting || (!editingPackage && !id)}
              className="flex items-center gap-2 rounded-lg bg-[#10271B] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0D2A1C] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Wave className="h-4 w-8 text-amber-400" aria-label="Kaydediliyor" />
                  <span>Kaydediliyor…</span>
                </>
              ) : (
                <span>Paketi Kaydet</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminTextField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground">
      {label}
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
      />
    </label>
  );
}

function AdminNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-muted-foreground">
      {label}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-white p-2 text-xs text-foreground"
      />
    </label>
  );
}
