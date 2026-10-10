/**
 * Payment amount consistency regression (offline, no network, no DB).
 *
 *   npx tsx scripts/test-payment-amount-consistency.ts
 *
 * 1. Pure pricing: the shared integer-kuruş calculation for single / multi
 *    package carts, percentage / fixed coupons, eligible packages, cap,
 *    minimum and rounding.
 * 2. paytr-create-token is executed in-process with a fake Supabase client and
 *    a stubbed fetch (the PayTR get-token POST is captured, never sent). The
 *    amount the PayTR form would carry is compared with what the cart /
 *    payment page displays (the summary total and the pay button).
 * 3. paytr-callback is executed in-process with locally signed payloads to
 *    check duplicate success / late failure on an already paid order.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Module, { register } from "node:module";
import { pathToFileURL } from "node:url";
import * as shared from "../supabase/functions/_shared/payments/pricing";
import * as frontend from "../src/lib/payments/pricing";

type Row = Record<string, unknown>;
type Handler = (req: Request) => Promise<Response>;

// --- Edge runtime stubs ----------------------------------------------------

const ESM_SUPABASE = "https://esm.sh/@supabase/supabase-js@2.49.1";
const supabaseStub = { createClient: () => (globalThis as Record<string, unknown>).__fakeAdmin };
const STUB_URL = `data:text/javascript,${encodeURIComponent("export const createClient = (...a) => globalThis.__fakeAdmin;")}`;
register(
  `data:text/javascript,${encodeURIComponent(
    `export async function resolve(s, c, n) { return s === ${JSON.stringify(ESM_SUPABASE)} ? { url: ${JSON.stringify(STUB_URL)}, shortCircuit: true } : n(s, c); }`
  )}`,
  pathToFileURL(__filename ?? process.cwd())
);
const moduleInternals = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown };
const originalLoad = moduleInternals._load;
moduleInternals._load = function (request: string, ...rest: unknown[]) {
  if (request === ESM_SUPABASE) return supabaseStub;
  return originalLoad.call(this, request, ...rest);
};

const env: Record<string, string> = {
  SUPABASE_URL: "https://fake.supabase.test",
  SUPABASE_SECRET_KEY: "sb_secret_offline_test_only",
  PAYTR_MERCHANT_ID: "000000",
  PAYTR_MERCHANT_KEY: "offline-test-key",
  PAYTR_MERCHANT_SALT: "offline-test-salt",
  PAYTR_TEST_MODE: "1",
  PUBLIC_SITE_URL: "https://oriens-academy.com",
};
let servedHandler: Handler | null = null;
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (name: string) => env[name] },
  serve: (handler: Handler) => {
    servedHandler = handler;
  },
};

async function loadHandler(path: string): Promise<Handler> {
  servedHandler = null;
  await import(path);
  assert.ok(servedHandler, `${path} did not register Deno.serve`);
  return servedHandler;
}

// --- Fake Supabase admin client ----------------------------------------------

interface Op {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
}

interface FakeDb {
  packages: Row[];
  rpc: (name: string, args: Row) => unknown;
  ops: Op[];
  rpcCalls: Array<{ name: string; args: Row }>;
}

function fakeAdmin(db: FakeDb) {
  const resolveOp = (op: Op, single: boolean): { data: unknown; error: null } => {
    db.ops.push(op);
    const filter = (name: string) => op.filters.find(([, column]) => column === name)?.[2];
    if (op.op === "select") {
      if (op.table === "guardian_accounts") {
        return { data: { user_id: GUARDIAN_ID, full_name: "Test Veli", email: "veli@example.test", email_verified_at: "2026-01-01T00:00:00Z", active: true, preferred_language: "tr" }, error: null };
      }
      if (op.table === "guardian_students") return { data: { active: true }, error: null };
      if (op.table === "student_profiles") return { data: { id: LEARNER_ID, full_name: "Test Öğrenci", active: true, legacy_auth_user_id: LEARNER_ID }, error: null };
      if (op.table === "pricing_packages") {
        const ids = filter("id");
        const rows = db.packages.filter((row) => (Array.isArray(ids) ? ids.includes(row.id) : row.id === ids));
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
      return { data: single ? null : [], error: null };
    }
    if (op.op === "insert" && op.table === "payment_transactions") {
      return { data: { id: "00000000-0000-4000-8000-0000000000aa", metadata: (op.payload as Row).metadata }, error: null };
    }
    return { data: null, error: null };
  };

  const builder = (table: string) => {
    const op: Op = { table, op: "select", filters: [] };
    const chain: Record<string, unknown> = {};
    const record = (kind: string) => (column: string, value: unknown) => {
      op.filters.push([kind, column, value]);
      return chain;
    };
    Object.assign(chain, {
      select: () => chain,
      insert: (payload: unknown) => ((op.op = "insert"), (op.payload = payload), chain),
      update: (payload: unknown) => ((op.op = "update"), (op.payload = payload), chain),
      delete: () => ((op.op = "delete"), chain),
      eq: record("eq"),
      in: record("in"),
      is: record("is"),
      gte: record("gte"),
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => resolveOp(op, true),
      single: async () => resolveOp(op, true),
      then: (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) => Promise.resolve(resolveOp(op, false)).then(ok, fail),
    });
    return chain;
  };

  return {
    from: builder,
    rpc: async (name: string, args: Row) => {
      db.rpcCalls.push({ name, args });
      return { data: db.rpc(name, args), error: null };
    },
    auth: {
      getUser: async () => ({ data: { user: { id: GUARDIAN_ID, app_metadata: {} } }, error: null }),
      admin: { getUserById: async () => ({ data: { user: { email: "veli@example.test" } }, error: null }) },
    },
  };
}

const GUARDIAN_ID = "11111111-1111-4111-8111-111111111111";
const LEARNER_ID = "22222222-2222-4222-8222-222222222222";
const COUPON_ID = "33333333-3333-4333-8333-333333333333";
const PACKAGES: Row[] = [
  { id: "single", name_tr: "Tek Ders", name_en: "Single", current_total: 3200, price_amount: 3200, currency: "TRY", lesson_count: 1, unit_price: 3200, purchase_mode: "purchasable", active: true },
  { id: "package5", name_tr: "5 Ders", name_en: "5 Lessons", current_total: 15000, price_amount: 15000, currency: "TRY", lesson_count: 5, unit_price: 3000, purchase_mode: "purchasable", active: true },
  { id: "package10", name_tr: "10 Ders", name_en: "10 Lessons", current_total: 27000, price_amount: 27000, currency: "TRY", lesson_count: 10, unit_price: 2700, purchase_mode: "purchasable", active: true },
  { id: "package30", name_tr: "30 Ders", name_en: "30 Lessons", current_total: 72000, price_amount: 72000, currency: "TRY", lesson_count: 30, unit_price: 2400, purchase_mode: "purchasable", active: true },
  { id: "package40", name_tr: "40 Ders", name_en: "40 Lessons", current_total: 100000, price_amount: 100000, currency: "TRY", lesson_count: 40, unit_price: 2500, purchase_mode: "purchasable", active: true },
  { id: "odd", name_tr: "Kuruşlu", name_en: "Odd", current_total: 333.33, price_amount: 333.33, currency: "TRY", lesson_count: 1, unit_price: 333.33, purchase_mode: "purchasable", active: true },
];

// Server rule as quote_checkout_coupon returns it (what both sides consume).
interface CouponDef {
  type: "percentage" | "fixed";
  value: number;
  max?: number | null;
  min?: number | null;
  packages?: string[]; // targeted packages; omitted = all
}
function quoteFor(coupon: CouponDef, packageIds: string[]): Row {
  const ids = [...new Set(packageIds)];
  const subtotal = ids.reduce((sum, id) => sum + Number(PACKAGES.find((p) => p.id === id)?.current_total ?? 0), 0);
  const eligible = (coupon.packages ? ids.filter((id) => coupon.packages!.includes(id)) : ids).sort();
  if (!eligible.length) return { valid: false, error_code: "PACKAGE_NOT_ELIGIBLE" };
  if (coupon.min && subtotal < coupon.min) return { valid: false, error_code: "MINIMUM_AMOUNT_NOT_MET" };
  return {
    valid: true,
    coupon_id: COUPON_ID,
    code: "TESTKUPON",
    name: null,
    discount_type: coupon.type,
    // PostgREST returns numeric columns as JSON numbers or strings; use strings to prove normalization.
    discount_value: String(coupon.value),
    maximum_discount_amount: coupon.max == null ? null : String(coupon.max),
    minimum_order_amount: coupon.min == null ? null : String(coupon.min),
    eligible_package_ids: eligible,
    currency: "TRY",
  };
}

// --- Frontend path (PaymentPage) ----------------------------------------------

// Table embed values (public, not merchant_key / merchant_salt). Dummy token: the real one lives in .env.local.

function frontendTotals(packageIds: string[], quote: Row | null) {
  // client.ts quoteCheckoutCoupon normalization → useCheckoutCoupon → page pricing
  const normalized = quote?.valid
    ? {
        ...quote,
        discount_value: Number(quote.discount_value),
        maximum_discount_amount: quote.maximum_discount_amount !== null ? Number(quote.maximum_discount_amount) : null,
        minimum_order_amount: quote.minimum_order_amount !== null ? Number(quote.minimum_order_amount) : null,
        eligible_package_ids: (quote.eligible_package_ids as string[]).map(String),
      }
    : quote;
  const rule = normalized ? frontend.couponRuleFromQuote(normalized) : null;
  const breakdown = frontend.calculateAuthoritativeTotal({
    packages: packageIds.map((id) => {
      const pkg = PACKAGES.find((p) => p.id === id)!;
      return { id, price: Number(pkg.current_total ?? pkg.price_amount ?? 0) };
    }),
    coupon: rule,
  });
  const finalPrice = breakdown.finalTotal;
  // PaymentPage: "Ödenecek tutar" + "<tutar> öde" butonu finalTotal'dan gelir.
  const displayAmount = frontend.kurusToDecimalString(breakdown.finalTotalKurus);
  return { breakdown, finalPrice, discount: breakdown.discount, displayAmount, couponCode: rule?.code };
}

// --- Server path (paytr-create-token) -----------------------------------------

async function serverTotals(tokenHandler: Handler, packageIds: string[], couponCode: string | undefined, coupon: CouponDef | null, extraBody: Row = {}) {
  const db: FakeDb = {
    packages: PACKAGES,
    ops: [],
    rpcCalls: [],
    rpc: (name, args) => {
      if (name === "quote_checkout_coupon") return coupon ? quoteFor(coupon, args.p_package_ids as string[]) : { valid: false, error_code: "COUPON_NOT_FOUND" };
      if (name === "finalize_zero_payment_order") return null;
      throw new Error(`unexpected rpc ${name}`);
    },
  };
  (globalThis as Record<string, unknown>).__fakeAdmin = fakeAdmin(db);
  let paytrForm: URLSearchParams | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://www.paytr.com/odeme/api/get-token") {
      paytrForm = new URLSearchParams(String(init?.body ?? ""));
      return new Response(JSON.stringify({ status: "success", token: "offline-iframe-token" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`network blocked in test: ${url}`);
  }) as typeof fetch;
  try {
    const response = await tokenHandler(
      new Request("https://fake.supabase.test/functions/v1/paytr-create-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer offline", Origin: "https://oriens-academy.com", "cf-connecting-ip": "203.0.113.10" },
        body: JSON.stringify({
          packageIds,
          learnerId: LEARNER_ID,
          couponCode,
          termsAccepted: true,
          refundPolicyAccepted: true,
          paymentPhone: "+905551112233",
          locale: "tr",
          ...extraBody,
        }),
      })
    );
    const body = (await response.json()) as Row;
    const txInsert = db.ops.find((op) => op.table === "payment_transactions" && op.op === "insert")?.payload as Row | undefined;
    const redemption = db.ops.find((op) => op.table === "discount_coupon_redemptions" && op.op === "insert")?.payload as Row | undefined;
    const form = paytrForm as URLSearchParams | null;
    return { status: response.status, body, db, txInsert, redemption, paymentAmount: form?.get("payment_amount") ?? null, basket: form?.get("user_basket") ?? null };
  } finally {
    globalThis.fetch = realFetch;
  }
}

// --- Runner -------------------------------------------------------------------

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
async function test(name: string, fn: () => Promise<string | void> | string | void) {
  try {
    const detail = (await fn()) || "";
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

const tl = (kurus: number) => (kurus / 100).toFixed(2);

async function main() {
  const tokenHandler = await loadHandler("../supabase/functions/paytr-create-token/index.ts");
  const callbackHandler = await loadHandler("../supabase/functions/paytr-callback/index.ts");

  /** Display total = PayTR payment_amount = stored transaction amount. */
  async function consistent(packageIds: string[], coupon: CouponDef | null, expectedFinalKurus: number, expectedDiscountKurus: number) {
    const quote = coupon ? quoteFor(coupon, packageIds) : null;
    const display = frontendTotals(packageIds, quote);
    const server = await serverTotals(tokenHandler, packageIds, display.couponCode, coupon);
    assert.equal(server.status, 200, `token status ${server.status} ${JSON.stringify(server.body)}`);
    assert.equal(display.breakdown.finalTotalKurus, expectedFinalKurus, "display final");
    assert.equal(display.breakdown.discountKurus, expectedDiscountKurus, "display discount");
    assert.equal(display.displayAmount, tl(expectedFinalKurus), "display amount");
    assert.equal(server.paymentAmount, String(expectedFinalKurus), "PayTR payment_amount");
    assert.equal(Number(server.txInsert?.amount), display.finalPrice, "transaction amount");
    assert.equal(server.body.final_amount, display.finalPrice, "server-computed final_amount in token response");
    if (coupon) {
      assert.equal(Number(server.redemption?.discount_amount), display.discount, "redemption discount");
      const calls = server.db.rpcCalls.filter((call) => call.name === "quote_checkout_coupon");
      assert.equal(calls.length, 1, "server re-quotes coupon once for the whole order");
      assert.deepEqual([...(calls[0].args.p_package_ids as string[])].sort(), [...packageIds].sort());
      assert.equal(calls[0].args.p_student_user_id, LEARNER_ID);
    } else {
      assert.equal(server.redemption, undefined);
    }
    // Basket lines (PayTR user_basket) sum exactly to payment_amount.
    const basket = JSON.parse(Buffer.from(server.basket ?? "", "base64").toString("utf8")) as Array<[string, string, number]>;
    const basketKurus = basket.reduce((sum, [, price]) => sum + Math.round(Number(price) * 100), 0);
    assert.equal(basketKurus, expectedFinalKurus, "basket sum");
    return `display=${tl(display.breakdown.finalTotalKurus)} shown=${display.displayAmount} paytr=${tl(Number(server.paymentAmount))} discount=${tl(display.breakdown.discountKurus)}`;
  }

  await test("FRONTEND USES SHARED PRICING MODULE", () => {
    assert.equal(frontend.calculateAuthoritativeTotal, shared.calculateAuthoritativeTotal);
    assert.equal(frontend.couponRuleFromQuote, shared.couponRuleFromQuote);
  });

  await test("KURUS → PAYTR AMOUNT FORMAT (integer only)", () => {
    const cases: Array<[number, string]> = [[2_700_000, "27000.00"], [4_200_000, "42000.00"], [188_138, "1881.38"], [16_210, "162.10"], [264_050, "2640.50"], [1, "0.01"], [32_333, "323.33"]];
    for (const [kurus, text] of cases) assert.equal(shared.kurusToDecimalString(kurus), text);
    for (const bad of [0, -100, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(shared.kurusToDecimalString(bad), "");
    // 0.1 + 0.2 → 30 kuruş → "0.30" (no float formatting involved)
    const drift = shared.calculateAuthoritativeTotal({ packages: [{ id: "a", price: 0.1 }, { id: "b", price: 0.2 }] });
    assert.equal(shared.kurusToDecimalString(drift.finalTotalKurus), "0.30");
    return cases.map(([, text]) => text).join(" ");
  });
  await test("SINGLE PACKAGE NO COUPON", () => consistent(["package5"], null, 1_500_000, 0));
  await test("SINGLE PACKAGE PERCENT COUPON", () => consistent(["package10"], { type: "percentage", value: 10 }, 2_430_000, 270_000));
  // Doğrudan ödeme (sepet yok): /tr/odeme/?package=package40 tek paketle gelir.
  await test("DIRECT CHECKOUT package40 NO COUPON", () => consistent(["package40"], null, 10_000_000, 0));
  await test("DIRECT CHECKOUT package40 PERCENT COUPON", () => consistent(["package40"], { type: "percentage", value: 10 }, 9_000_000, 1_000_000));
  await test("DIRECT CHECKOUT package40 MAX DISCOUNT (10%, cap 2500)", () => consistent(["package40"], { type: "percentage", value: 10, max: 2500 }, 9_750_000, 250_000));
  await test("DIRECT CHECKOUT package40 FIXED COUPON", () => consistent(["package40"], { type: "fixed", value: 5000 }, 9_500_000, 500_000));
  await test("MULTI PACKAGE NO COUPON (A)", () => consistent(["package5", "package10"], null, 4_200_000, 0));
  await test("MULTI PACKAGE ONE-ELIGIBLE PERCENT (B: package5)", () =>
    consistent(["package5", "package10"], { type: "percentage", value: 10, packages: ["package5"] }, 4_050_000, 150_000));
  await test("MULTI PACKAGE ONE-ELIGIBLE PERCENT (C: package10)", () =>
    consistent(["package5", "package10"], { type: "percentage", value: 10, packages: ["package10"] }, 3_930_000, 270_000));
  await test("MULTI PACKAGE ALL-ELIGIBLE PERCENT (D)", () =>
    consistent(["package5", "package10"], { type: "percentage", value: 10, packages: ["package5", "package10"] }, 3_780_000, 420_000));
  await test("MULTI PACKAGE UNTARGETED PERCENT", () => consistent(["package10", "package5"], { type: "percentage", value: 10 }, 3_780_000, 420_000));
  await test("FIXED COUPON (E)", () => consistent(["package5", "package10"], { type: "fixed", value: 1000 }, 4_100_000, 100_000));
  await test("FIXED COUPON ONE-ELIGIBLE CAPPED AT PACKAGE", () =>
    consistent(["single", "package5"], { type: "fixed", value: 5000, packages: ["single"] }, 1_500_000, 320_000));
  await test("MAXIMUM DISCOUNT (F: 5+10, 10%, cap 2500)", () =>
    consistent(["package5", "package10"], { type: "percentage", value: 10, max: 2500 }, 3_950_000, 250_000));
  await test("MAXIMUM DISCOUNT (30000 eligible, 20%, cap 2500 → 2500)", () => {
    const rule = shared.couponRuleFromQuote({ valid: true, coupon_id: COUPON_ID, code: "X", discount_type: "percentage", discount_value: "20", maximum_discount_amount: "2500", eligible_package_ids: ["a"] });
    const result = shared.calculateAuthoritativeTotal({ packages: [{ id: "a", price: 30000 }], coupon: rule });
    assert.equal(result.discountKurus, 250_000);
    assert.equal(result.finalTotalKurus, 2_750_000);
    return `discount=${tl(result.discountKurus)} final=${tl(result.finalTotalKurus)}`;
  });
  await test("MAXIMUM DISCOUNT ACROSS PACKAGES (30 lessons + 5, 20%, cap 2500)", () =>
    consistent(["package30", "package5"], { type: "percentage", value: 20, max: 2500 }, 8_450_000, 250_000));
  await test("MINIMUM SUBTOTAL (G: met by order subtotal)", () =>
    consistent(["package5", "package10"], { type: "percentage", value: 10, min: 40000, packages: ["package5"] }, 4_050_000, 150_000));
  await test("MINIMUM SUBTOTAL (G: not met → no discount anywhere)", async () => {
    const coupon: CouponDef = { type: "percentage", value: 10, min: 50000 };
    const quote = quoteFor(coupon, ["package5", "package10"]);
    assert.equal(quote.valid, false);
    const display = frontendTotals(["package5", "package10"], quote);
    assert.equal(display.breakdown.finalTotalKurus, 4_200_000);
    assert.equal(display.couponCode, undefined, "invalid coupon is not sent");
    const server = await serverTotals(tokenHandler, ["package5", "package10"], "TESTKUPON", coupon);
    assert.equal(server.status, 400);
    assert.equal(server.body.error_code, "INVALID_COUPON");
    assert.equal(server.paymentAmount, null, "no PayTR request");
    assert.equal(server.txInsert, undefined, "no transaction");
    // the rule's own guard also refuses a below-minimum order
    const rule = shared.couponRuleFromQuote({ ...quoteFor({ type: "percentage", value: 10 }, ["package5"]), minimum_order_amount: 50000 });
    assert.equal(shared.calculateAuthoritativeTotal({ packages: [{ id: "package5", price: 15000 }], coupon: rule }).discountKurus, 0);
    return "display=42000.00, server rejects coupon, no PayTR call";
  });
  await test("ROUNDING", async () => {
    // 333.33 TL × 3 % = 9.9999 TL → 10.00 TL (half-up, once); float math would give 9.9999…
    const r1 = shared.calculateAuthoritativeTotal({
      packages: [{ id: "odd", price: 333.33 }],
      coupon: { id: "c", code: "c", discount_type: "percentage", discount_value: 3, eligible_package_ids: ["odd"] },
    });
    assert.equal(r1.discountKurus, 1000);
    assert.equal(r1.finalTotalKurus, 32333);
    // 0.1 + 0.2 style drift: 3 items of 0.10 + 0.20
    const r2 = shared.calculateAuthoritativeTotal({ packages: [{ id: "a", price: 0.1 }, { id: "b", price: 0.2 }] });
    assert.equal(r2.subtotalKurus, 30);
    assert.equal(r2.finalTotal, 0.3);
    // 12.5 % of 27000 + 15000 split proportionally; item discounts sum exactly
    const r3 = shared.calculateAuthoritativeTotal({
      packages: [{ id: "x", price: 15000.01 }, { id: "y", price: 27000.02 }],
      coupon: { id: "c", code: "c", discount_type: "percentage", discount_value: 12.5, eligible_package_ids: ["x", "y"] },
    });
    assert.equal(r3.discountKurus, Math.floor((4_200_003 * 1250 + 5000) / 10000));
    assert.equal(r3.items.reduce((sum, item) => sum + item.discountKurus, 0), r3.discountKurus);
    assert.equal(r3.items.reduce((sum, item) => sum + item.finalKurus, 0), r3.finalTotalKurus);
    assert.equal(r3.paymentAmountPaytr, String(r3.finalTotalKurus));
    // end-to-end with a kuruş price
    return consistent(["odd", "package5"], { type: "percentage", value: 3, packages: ["odd"] }, 33333 + 1_500_000 - 1000, 1000);
  });
  await test("DISPLAY = PAYTR (all scenarios)", async () => {
    const scenarios: Array<[string[], CouponDef | null]> = [
      [["package5", "package10"], null],
      [["package5", "package10"], { type: "percentage", value: 10, packages: ["package5"] }],
      [["package5", "package10"], { type: "percentage", value: 10, packages: ["package10"] }],
      [["package5", "package10"], { type: "percentage", value: 10 }],
      [["package5", "package10"], { type: "fixed", value: 1000 }],
      [["package5", "package10"], { type: "percentage", value: 10, max: 2500 }],
      [["single", "package5", "package10", "package30"], { type: "percentage", value: 7.5, packages: ["single", "package30"] }],
    ];
    const lines: string[] = [];
    for (const [ids, coupon] of scenarios) {
      const display = frontendTotals(ids, coupon ? quoteFor(coupon, ids) : null);
      const server = await serverTotals(tokenHandler, ids, display.couponCode, coupon);
      assert.equal(server.status, 200);
      assert.equal(display.displayAmount, tl(Number(server.paymentAmount)));
      assert.equal(Number(server.txInsert?.amount).toFixed(2), display.displayAmount);
      lines.push(display.displayAmount);
    }
    return lines.join(" | ");
  });
  await test("CLIENT TOTAL IS IGNORED BY TOKEN FUNCTION", async () => {
    const server = await serverTotals(tokenHandler, ["package5", "package10"], "TESTKUPON", { type: "percentage", value: 10, packages: ["package5"] }, {
      amount: 1,
      finalAmount: 1,
      final_amount: 1,
      discountAmount: 41999,
      price: 1,
    });
    assert.equal(server.status, 200);
    assert.equal(server.paymentAmount, "4050000");
    return "payment_amount=4050000 despite forged client totals";
  });
  await test("ZERO TOTAL ORDER SKIPS PAYTR", async () => {
    const server = await serverTotals(tokenHandler, ["single"], "TESTKUPON", { type: "fixed", value: 5000 });
    assert.equal(server.status, 200);
    assert.equal(server.body.zero_payment, true);
    assert.equal(server.paymentAmount, null);
    assert.equal(Number(server.txInsert?.amount), 0);
  });

  // --- Callback ---------------------------------------------------------------

  async function callback(status: "success" | "failed", rpcResult: Row, options: { badHash?: boolean } = {}) {
    const merchantOid = "ORI20261008OFFLINE01";
    const totalAmount = "4050000";
    const hash = createHmac("sha256", env.PAYTR_MERCHANT_KEY).update(merchantOid + env.PAYTR_MERCHANT_SALT + status + totalAmount).digest("base64");
    const db: FakeDb = { packages: PACKAGES, ops: [], rpcCalls: [], rpc: () => rpcResult };
    (globalThis as Record<string, unknown>).__fakeAdmin = fakeAdmin(db);
    const response = await callbackHandler(
      new Request("https://fake.supabase.test/functions/v1/paytr-callback", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          merchant_oid: merchantOid,
          status,
          total_amount: totalAmount,
          payment_amount: totalAmount,
          hash: options.badHash ? "invalid" : hash,
          ...(status === "failed" ? { failed_reason_code: "6", failed_reason_msg: "late" } : {}),
        }).toString(),
      })
    );
    const writes = db.ops.filter((op) => op.op !== "select");
    const auditActions = writes.filter((op) => op.table === "audit_logs").map((op) => (op.payload as Row).action);
    const otherWrites = writes.filter((op) => op.table !== "audit_logs");
    return { status: response.status, text: await response.text(), auditActions, otherWrites, rpcCalls: db.rpcCalls };
  }

  await test("PAID + DUPLICATE SUCCESS", async () => {
    const result = await callback("success", { success: true, already_paid: true, status: "paid", transaction_id: "tx" });
    assert.equal(result.status, 200);
    assert.equal(result.text, "OK");
    assert.equal(result.rpcCalls.length, 1);
    assert.equal(result.otherWrites.length, 0);
    assert.ok(!result.auditActions.includes("payment_completed"), "no second completion event");
    return `HTTP ${result.status} ${result.text}, audit=[${result.auditActions.join(",")}]`;
  });
  await test("PAID + LATE FAILED CALLBACK", async () => {
    const result = await callback("failed", { success: false, error_code: "CANNOT_DOWNGRADE_PAID_TRANSACTION" });
    assert.equal(result.status, 200);
    assert.equal(result.text, "OK");
    assert.equal(result.otherWrites.length, 0, "no transaction / rights / coupon writes");
    assert.ok(result.auditActions.includes("paytr_callback_late_failure_ignored"));
    assert.ok(!result.auditActions.includes("payment_failed"));
    return `HTTP ${result.status} ${result.text}, audit=[${result.auditActions.join(",")}]`;
  });
  await test("CALLBACK INVALID HASH STILL REJECTED", async () => {
    const result = await callback("failed", { success: false, error_code: "CANNOT_DOWNGRADE_PAID_TRANSACTION" }, { badHash: true });
    assert.equal(result.status, 400);
    assert.equal(result.rpcCalls.length, 0, "no DB call before signature check");
  });
  await test("CALLBACK AMOUNT MISMATCH STILL REJECTED", async () => {
    const result = await callback("success", { success: false, error_code: "AMOUNT_MISMATCH", message: "mismatch" });
    assert.equal(result.status, 500);
    assert.notEqual(result.text, "OK");
    assert.ok(result.auditActions.includes("paytr_callback_amount_mismatch"));
  });
  await test("CALLBACK NORMAL FAILED (pending order) UNCHANGED", async () => {
    const result = await callback("failed", { success: true, already_paid: false, status: "failed", transaction_id: "tx" });
    assert.equal(result.text, "OK");
    assert.ok(result.auditActions.includes("payment_failed"));
  });

  let failed = 0;
  for (const { name, ok, detail } of results) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

void main();
