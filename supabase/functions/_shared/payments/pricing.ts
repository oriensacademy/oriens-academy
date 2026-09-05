/**
 * Authoritative Integer-Kuruş Pricing Calculation Module (Deno / Edge Functions)
 *
 * Ensures all financial operations are executed in exact minor units (integer kuruş,
 * 1 TL = 100 kuruş) across cart review, checkout, and PayTR token generation.
 * Eliminates floating-point arithmetic drift and guarantees:
 *
 * CART DISPLAYED FINAL = SERVER FINAL = PAYMENT_TRANSACTION FINAL = PAYTR payment_amount = CALLBACK EXPECTED AMOUNT
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
  maximum_discount_amount?: number | null; // in TL
  minimum_order_amount?: number | null; // in TL
  applicable_package_id?: string | null;
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
  items: ItemCalculation[];
}

export function toKurus(tlAmount: number): number {
  if (!Number.isFinite(tlAmount) || tlAmount <= 0) return 0;
  return Math.round(tlAmount * 100);
}

export function toTL(kurusAmount: number): number {
  if (!Number.isFinite(kurusAmount) || kurusAmount <= 0) return 0;
  return Math.round(kurusAmount) / 100;
}

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

  if (coupon && subtotalKurus > 0) {
    couponId = coupon.id;
    couponCode = coupon.code.toUpperCase().trim();
    discountType = coupon.discount_type;
    discountValue = coupon.discount_value;

    const minOrderKurus = coupon.minimum_order_amount ? toKurus(coupon.minimum_order_amount) : 0;
    if (minOrderKurus > 0 && subtotalKurus < minOrderKurus) {
      discountKurus = 0;
    } else {
      const eligibleItems = coupon.applicable_package_id
        ? items.filter((item) => item.packageId === coupon.applicable_package_id)
        : items;

      const eligibleKurus = eligibleItems.reduce((sum, item) => sum + item.baseKurus, 0);

      if (eligibleKurus > 0) {
        if (coupon.discount_type === "percentage") {
          let calculatedDiscount = Math.round((eligibleKurus * coupon.discount_value) / 100);

          if (coupon.maximum_discount_amount && coupon.maximum_discount_amount > 0) {
            const maxDiscountKurus = toKurus(coupon.maximum_discount_amount);
            calculatedDiscount = Math.min(calculatedDiscount, maxDiscountKurus);
          }

          discountKurus = Math.min(calculatedDiscount, eligibleKurus);
        } else if (coupon.discount_type === "fixed") {
          const fixedDiscountKurus = toKurus(coupon.discount_value);
          discountKurus = Math.min(fixedDiscountKurus, eligibleKurus);
        }

        let remainingDiscount = discountKurus;
        for (const item of eligibleItems) {
          if (remainingDiscount <= 0) break;
          const itemDiscount = Math.min(item.baseKurus, remainingDiscount);
          item.discountKurus = itemDiscount;
          item.finalKurus = Math.max(0, item.baseKurus - itemDiscount);
          item.discountAmount = toTL(item.discountKurus);
          item.finalAmount = toTL(item.finalKurus);
          remainingDiscount -= itemDiscount;
        }
      }
    }
  }

  discountKurus = Math.min(discountKurus, subtotalKurus);
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
    items,
  };
}
