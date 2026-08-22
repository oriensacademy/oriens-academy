export interface DiscountCoupon {
  id: string;
  code: string;
  name: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  currency: string;
  minimum_order_amount: number | null;
  maximum_discount_amount: number | null;
  max_total_uses: number | null;
  max_uses_per_student: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  active: boolean;
  first_purchase_only: boolean;
  created_at: string;
  updated_at: string;
  package_ids?: string[];
}

export interface CouponValidationSuccess {
  valid: true;
  coupon_id: string;
  code: string;
  name: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  discount_amount: number;
  base_amount: number;
  final_amount: number;
  currency: string;
}

export interface CouponValidationFailure {
  valid: false;
  error_code: string;
  message: string;
}

export type CouponValidationResult = CouponValidationSuccess | CouponValidationFailure;

export interface CreateCouponInput {
  code: string;
  name?: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  currency?: string;
  minimum_order_amount?: number | null;
  maximum_discount_amount?: number | null;
  max_total_uses?: number | null;
  max_uses_per_student?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  active?: boolean;
  first_purchase_only?: boolean;
  package_ids?: string[];
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {
  id: string;
}
