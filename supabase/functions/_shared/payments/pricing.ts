/**
 * Authoritative Integer-Kuruş Pricing Calculation Module
 *
 * TEK KAYNAK: bu dosya hem Edge Function'larda (paytr-create-token) hem de
 * ön yüzde (src/lib/payments/pricing.ts bu dosyayı yeniden dışa aktarır)
 * çalışan TEK fiyat hesabıdır. Deno ve Next.js ortak kullandığı için import
 * içermez.
 *
 * Tüm tutarlar tam sayı kuruş (1 TL = 100 kuruş) üzerinden hesaplanır;
 * yuvarlama yalnız yüzde indirimde, tek bir noktada (yarım kuruş yukarı) yapılır.
 *
 * Kupon kuralı sunucudaki quote_checkout_coupon RPC'sinden gelir (uygun paketler,
 * en yüksek indirim, en düşük sepet tutarı); aynı kural + aynı paketler →
 * aynı sonuç:
 *
 * CART DISPLAYED FINAL = INSTALLMENT TABLE AMOUNT = SERVER FINAL =
 * PAYMENT_TRANSACTION FINAL = PAYTR payment_amount = CALLBACK EXPECTED AMOUNT
 */

export interface PricingItem {
  id: string;
  price: number; // in TL
  name_tr?: string | null;
  name_en?: string | null;
  lesson_count?: number | null;
}

export interface CouponRuleSnapshot {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number; // percentage (e.g. 10 for 10%) or fixed amount in TL
  maximum_discount_amount?: number | null; // in TL, applied once per order
  minimum_order_amount?: number | null; // in TL, compared with the order subtotal
  eligible_package_ids?: string[] | null; // null/undefined → every package in the order
}

export interface ItemCalculation {
  packageId: string;
  baseKurus: number;
  discountKurus: number;
  finalKurus: number;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
}

export interface AuthoritativePriceBreakdown {
  subtotalKurus: number;
  discountKurus: number;
  finalTotalKurus: number;
  subtotal: number; // in TL (subtotalKurus / 100)
  discount: number; // in TL (discountKurus / 100)
  finalTotal: number; // in TL (finalTotalKurus / 100)
  paymentAmountPaytr: string; // integer kuruş formatted as string e.g. "243000"
  couponId: string | null;
  couponCode: string | null;
  discountType: "percentage" | "fixed" | null;
  discountValue: number | null;
  eligiblePackageIds: string[];
  items: ItemCalculation[];
}

/**
 * Converts a TL float/number safely to integer kuruş without precision loss.
 */
export function toKurus(tlAmount: number): number {
  if (!Number.isFinite(tlAmount) || tlAmount <= 0) return 0;
  return Math.round(tlAmount * 100);
}

/**
 * Converts integer kuruş back to a 2-decimal TL amount.
 */
export function toTL(kurusAmount: number): number {
  if (!Number.isFinite(kurusAmount) || kurusAmount <= 0) return 0;
  return Math.round(kurusAmount) / 100;
}

const optionalAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

/**
 * Maps a quote_checkout_coupon RPC result to the pricing rule. Returns null for
 * an invalid / malformed quote so callers never apply a guessed discount.
 */
export function couponRuleFromQuote(quote: unknown): CouponRuleSnapshot | null {
  if (!quote || typeof quote !== "object") return null;
  const row = quote as Record<string, unknown>;
  if (row.valid !== true || !row.coupon_id || !row.code) return null;
  if (row.discount_type !== "percentage" && row.discount_type !== "fixed") return null;
  const discountValue = Number(row.discount_value);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return null;
  if (!Array.isArray(row.eligible_package_ids) || !row.eligible_package_ids.length) return null;
  return {
    id: String(row.coupon_id),
    code: String(row.code),
    discount_type: row.discount_type,
    discount_value: discountValue,
    maximum_discount_amount: optionalAmount(row.maximum_discount_amount),
    minimum_order_amount: optionalAmount(row.minimum_order_amount),
    eligible_package_ids: row.eligible_package_ids.map((id) => String(id)),
  };
}

/**
 * Percentage of an integer kuruş amount, rounded half-up exactly once.
 * The rate is carried as an integer in hundredths of a percent so no float
 * product can drift across a rounding boundary.
 */
function percentageOfKurus(kurus: number, percent: number): number {
  const rateHundredths = Math.round(Math.min(Math.max(percent, 0), 100) * 100);
  return Math.floor((kurus * rateHundredths + 5000) / 10000);
}

/**
 * Splits an order-level discount over the eligible items in proportion to
 * their price (largest remainder), so the item amounts always sum exactly to
 * the order discount.
 */
function allocateDiscount(items: ItemCalculation[], discountKurus: number, eligibleKurus: number) {
  if (discountKurus <= 0 || eligibleKurus <= 0) return;
  let allocated = 0;
  const shares = items.map((item, index) => {
    const exact = discountKurus * item.baseKurus;
    const share = Math.floor(exact / eligibleKurus);
    allocated += share;
    return { item, index, share, remainder: exact % eligibleKurus };
  });
  let left = discountKurus - allocated;
  for (const entry of [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (left <= 0) break;
    if (entry.share < entry.item.baseKurus) {
      entry.share += 1;
      left -= 1;
    }
  }
  for (const { item, share } of shares) {
    item.discountKurus = share;
    item.finalKurus = item.baseKurus - share;
    item.discountAmount = toTL(item.discountKurus);
    item.finalAmount = toTL(item.finalKurus);
  }
}

/**
 * Authoritative single source of truth for calculating cart and order checkout totals.
 */
export function calculateAuthoritativeTotal(params: {
  packages: PricingItem[];
  coupon?: CouponRuleSnapshot | null;
}): AuthoritativePriceBreakdown {
  const { packages, coupon } = params;

  let subtotalKurus = 0;
  const items: ItemCalculation[] = packages.map((pkg) => {
    const baseKurus = toKurus(pkg.price);
    subtotalKurus += baseKurus;
    return {
      packageId: pkg.id,
      baseKurus,
      discountKurus: 0,
      finalKurus: baseKurus,
      baseAmount: toTL(baseKurus),
      discountAmount: 0,
      finalAmount: toTL(baseKurus),
    };
  });

  let discountKurus = 0;
  let couponId: string | null = null;
  let couponCode: string | null = null;
  let discountType: "percentage" | "fixed" | null = null;
  let discountValue: number | null = null;
  let eligiblePackageIds: string[] = [];

  if (coupon && subtotalKurus > 0) {
    couponId = coupon.id;
    couponCode = coupon.code.toUpperCase().trim();
    discountType = coupon.discount_type;
    discountValue = coupon.discount_value;

    const minOrderKurus = coupon.minimum_order_amount ? toKurus(coupon.minimum_order_amount) : 0;
    if (!(minOrderKurus > 0 && subtotalKurus < minOrderKurus)) {
      const eligibleSet = coupon.eligible_package_ids ? new Set(coupon.eligible_package_ids) : null;
      const eligibleItems = eligibleSet ? items.filter((item) => eligibleSet.has(item.packageId)) : items;
      const eligibleKurus = eligibleItems.reduce((sum, item) => sum + item.baseKurus, 0);
      eligiblePackageIds = eligibleItems.map((item) => item.packageId);

      if (eligibleKurus > 0) {
        if (coupon.discount_type === "percentage") {
          discountKurus = percentageOfKurus(eligibleKurus, coupon.discount_value);
          // The cap applies once to the whole order (percentage coupons only,
          // as in validate_checkout_coupon and the admin coupon form).
          const maxDiscountKurus = coupon.maximum_discount_amount ? toKurus(coupon.maximum_discount_amount) : 0;
          if (maxDiscountKurus > 0) discountKurus = Math.min(discountKurus, maxDiscountKurus);
        } else if (coupon.discount_type === "fixed") {
          discountKurus = toKurus(coupon.discount_value);
        }

        discountKurus = Math.max(0, Math.min(discountKurus, eligibleKurus));
        allocateDiscount(eligibleItems, discountKurus, eligibleKurus);
      }
    }
  }

  const finalTotalKurus = Math.max(0, subtotalKurus - discountKurus);

  return {
    subtotalKurus,
    discountKurus,
    finalTotalKurus,
    subtotal: toTL(subtotalKurus),
    discount: toTL(discountKurus),
    finalTotal: toTL(finalTotalKurus),
    paymentAmountPaytr: finalTotalKurus.toString(),
    couponId,
    couponCode,
    discountType,
    discountValue,
    eligiblePackageIds,
    items,
  };
}
