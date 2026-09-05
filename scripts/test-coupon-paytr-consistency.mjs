/**
 * Regression Test Suite: Coupon, Cart & PayTR Financial Consistency
 *
 * Test Matrix:
 * 1. Unit Invariants (Integer Kuruş):
 *    - No coupon: subtotal = 2700, discount = 0, final = 2700, PayTR = 270000
 *    - 10% coupon: subtotal = 2700, discount = 270, final = 2430, PayTR = 243000
 *    - Fixed coupon: subtotal = 2700, discount = 500, final = 2200, PayTR = 220000
 * 2. Live Edge Function (Dynamic DB Package Price):
 *    - No coupon: final_amount = DB price, PayTR token generated, DB snapshot integer kuruş verified
 *    - 10% coupon: final_amount = DB price - 10%, PayTR token generated, DB snapshot integer kuruş verified
 *    - Fixed coupon: final_amount = DB price - 500, PayTR token generated, DB snapshot integer kuruş verified
 *    - Invalid coupon: rejected (400 INVALID_COUPON), no fake discount token
 *    - Expired coupon: rejected (400 INVALID_COUPON), no token
 *    - Client tamper: client sends fake price (1 TL) -> server ignores it and computes authoritative price
 *    - Invalidation: coupon change/remove produces new merchant_oid and restores full price
 *    - PayTR callback amount consistency: mismatch rejected (AMOUNT_MISMATCH), exact match verified and idempotent
 *
 * Usage:
 *   node scripts/test-coupon-paytr-consistency.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

function toKurus(tlAmount) {
  if (!Number.isFinite(tlAmount) || tlAmount <= 0) return 0;
  return Math.round(tlAmount * 100);
}

function toTL(kurusAmount) {
  if (!Number.isFinite(kurusAmount) || kurusAmount <= 0) return 0;
  return Math.round(kurusAmount) / 100;
}

function calculateAuthoritativeTotal(params) {
  const { packages, coupon } = params;

  let subtotalKurus = 0;
  const items = packages.map((pkg) => {
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
  let couponId = null;
  let couponCode = null;
  let discountType = null;
  let discountValue = null;

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

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log("  PASS  " + name);
  } else {
    failures.push(name + (detail ? " -- " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " -- " + detail : ""));
  }
}

const stamp = Date.now();
const FIXTURE_EMAIL = `coupon-qa-${stamp}@oriens-academy-test.invalid`;
const FIXTURE_PASSWORD = `Cp!${stamp}aA9`;
const PACKAGE_ID = "single";

let guardianUserId = null;
let learnerId = null;
let packagePrice = 3200;
const createdReferences = [];
const createdCouponIds = [];

const CODE_10 = `TEST10_${stamp}`.slice(0, 20);
const CODE_FIXED = `TEST500_${stamp}`.slice(0, 20);
const CODE_EXPIRED = `TESTEXP_${stamp}`.slice(0, 20);

async function callCreateToken(accessToken, payload = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/paytr-create-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({
      packageIds: [PACKAGE_ID],
      learnerId,
      paymentPhone: "+905000000000",
      locale: "tr",
      termsAccepted: true,
      refundPolicyAccepted: true,
      legalVersions: { salesAgreement: "test", preInformation: "test", refundPolicy: "test" },
      ...payload,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (json?.merchant_oid) createdReferences.push(json.merchant_oid);
  return { status: res.status, json };
}

async function setup() {
  console.log("\n[0] Kurulum: Test hesabı ve test kuponları oluşturuluyor");

  // Read actual package price
  const { data: pkgRow } = await admin
    .from("pricing_packages")
    .select("current_total,price_amount")
    .eq("id", PACKAGE_ID)
    .single();
  packagePrice = Number(pkgRow?.current_total ?? pkgRow?.price_amount ?? 3200);
  console.log(`  Paket '${PACKAGE_ID}' fiyatı: ${packagePrice} TL`);

  // 1. Create coupons
  const { data: c1, error: e1 } = await admin
    .from("discount_coupons")
    .insert({
      code: CODE_10,
      name: "Test 10% Coupon",
      discount_type: "percentage",
      discount_value: 10,
      currency: "TRY",
      active: true,
    })
    .select("id")
    .single();
  if (e1) throw new Error("10% kupon oluşturulamadı: " + e1.message);
  createdCouponIds.push(c1.id);

  const { data: c2, error: e2 } = await admin
    .from("discount_coupons")
    .insert({
      code: CODE_FIXED,
      name: "Test 500 TL Fixed Coupon",
      discount_type: "fixed",
      discount_value: 500,
      currency: "TRY",
      active: true,
    })
    .select("id")
    .single();
  if (e2) throw new Error("Fixed kupon oluşturulamadı: " + e2.message);
  createdCouponIds.push(c2.id);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: c3, error: e3 } = await admin
    .from("discount_coupons")
    .insert({
      code: CODE_EXPIRED,
      name: "Test Expired Coupon",
      discount_type: "percentage",
      discount_value: 20,
      currency: "TRY",
      valid_until: yesterday,
      active: true,
    })
    .select("id")
    .single();
  if (e3) throw new Error("Expired kupon oluşturulamadı: " + e3.message);
  createdCouponIds.push(c3.id);

  // 2. Create user & learner
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Kupon QA Test Kullanicisi" },
  });
  if (createError) throw new Error("fixture kullanıcı oluşturulamadı: " + createError.message);
  guardianUserId = created.user.id;

  await admin.from("guardian_accounts").upsert({
    user_id: guardianUserId,
    email: FIXTURE_EMAIL,
    full_name: "Kupon QA Test Kullanicisi",
    email_verified_at: new Date().toISOString(),
    active: true,
    preferred_language: "tr",
  });

  const { data: learner, error: learnerError } = await admin
    .from("student_profiles")
    .insert({ id: randomUUID(), full_name: "Kupon Test Ogrencisi", email: `learner-${stamp}@oriens-academy-test.invalid`, active: true })
    .select("id")
    .single();
  if (learnerError) throw new Error("fixture öğrenci oluşturulamadı: " + learnerError.message);
  learnerId = learner.id;

  await admin.from("guardian_students").insert({
    guardian_user_id: guardianUserId,
    student_id: learnerId,
    active: true,
    is_primary: true,
  });

  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
  });
  if (signInError || !session.session) throw new Error("fixture oturumu açılamadı: " + (signInError?.message || "no session"));
  console.log("  test ortamı hazır. Hesabım:", FIXTURE_EMAIL);
  return { accessToken: session.session.access_token, c1, c2, c3 };
}

async function cleanup() {
  console.log("\n[Temizlik] Test fixture verileri siliniyor");
  if (createdReferences.length) {
    await admin.from("payment_transactions").delete().in("public_reference", createdReferences);
  }
  if (createdCouponIds.length) {
    await admin.from("discount_coupon_redemptions").delete().in("coupon_id", createdCouponIds);
    await admin.from("discount_coupons").delete().in("id", createdCouponIds);
  }
  if (learnerId) {
    await admin.from("guardian_students").delete().eq("student_id", learnerId);
    await admin.from("student_profiles").delete().eq("id", learnerId);
  }
  if (guardianUserId) {
    await admin.from("guardian_accounts").delete().eq("user_id", guardianUserId);
    await admin.auth.admin.deleteUser(guardianUserId);
  }
  console.log("  temizlik tamamlandı");
}

(async () => {
  console.log("=== Oriens Academy: Kupon & PayTR Finansal Tutarlılık Testi ===");

  // -------------------------------------------------------------
  // Test 1: Unit Pricing & Integer Kuruş Invariants (Example 2700 TL)
  // -------------------------------------------------------------
  console.log("\n[1] Authoritative Pricing Unit Invariants (Integer Kuruş)");
  const pNoCoupon = calculateAuthoritativeTotal({
    packages: [{ id: "single", price: 2700 }],
  });
  check("No Coupon: subtotal = 2700 TL", pNoCoupon.subtotal === 2700);
  check("No Coupon: subtotalKurus = 270000", pNoCoupon.subtotalKurus === 270000);
  check("No Coupon: discount = 0", pNoCoupon.discount === 0 && pNoCoupon.discountKurus === 0);
  check("No Coupon: finalTotal = 2700", pNoCoupon.finalTotal === 2700);
  check("No Coupon: paymentAmountPaytr = '270000'", pNoCoupon.paymentAmountPaytr === "270000");

  const p10 = calculateAuthoritativeTotal({
    packages: [{ id: "single", price: 2700 }],
    coupon: { id: "c10", code: "TEST10", discount_type: "percentage", discount_value: 10 },
  });
  check("10% Coupon: subtotal = 2700 TL", p10.subtotal === 2700);
  check("10% Coupon: discount = 270 TL (27000 kuruş)", p10.discount === 270 && p10.discountKurus === 27000);
  check("10% Coupon: finalTotal = 2430 TL (243000 kuruş)", p10.finalTotal === 2430 && p10.finalTotalKurus === 243000);
  check("10% Coupon: paymentAmountPaytr = '243000'", p10.paymentAmountPaytr === "243000");

  const pFixed = calculateAuthoritativeTotal({
    packages: [{ id: "single", price: 2700 }],
    coupon: { id: "cfixed", code: "TEST500", discount_type: "fixed", discount_value: 500 },
  });
  check("Fixed Coupon: discount = 500 TL (50000 kuruş)", pFixed.discount === 500 && pFixed.discountKurus === 50000);
  check("Fixed Coupon: finalTotal = 2200 TL (220000 kuruş)", pFixed.finalTotal === 2200 && pFixed.finalTotalKurus === 220000);
  check("Fixed Coupon: paymentAmountPaytr = '220000'", pFixed.paymentAmountPaytr === "220000");

  let setupData;
  try {
    setupData = await setup();
  } catch (err) {
    console.error("KURULUM HATASI:", err.message);
    await cleanup();
    process.exit(1);
  }

  const { accessToken, c1, c2 } = setupData;

  // Compute expected totals dynamically for the database package
  const expNoCoupon = calculateAuthoritativeTotal({
    packages: [{ id: PACKAGE_ID, price: packagePrice }],
  });
  const exp10 = calculateAuthoritativeTotal({
    packages: [{ id: PACKAGE_ID, price: packagePrice }],
    coupon: { id: c1.id, code: CODE_10, discount_type: "percentage", discount_value: 10 },
  });
  const expFixed = calculateAuthoritativeTotal({
    packages: [{ id: PACKAGE_ID, price: packagePrice }],
    coupon: { id: c2.id, code: CODE_FIXED, discount_type: "fixed", discount_value: 500 },
  });

  try {
    // -------------------------------------------------------------
    // Test 2: Edge Function — No Coupon
    // -------------------------------------------------------------
    console.log("\n[2] Edge Function: Kuponsuz Ödeme Başlatma");
    const rNoCoupon = await callCreateToken(accessToken);
    check("Kuponsuz oturum açıldı", rNoCoupon.json?.success === true);
    check(`Kuponsuz final_amount = ${expNoCoupon.finalTotal} TL`, rNoCoupon.json?.final_amount === expNoCoupon.finalTotal);
    check("Kuponsuz PayTR token üretildi", Boolean(rNoCoupon.json?.iframe_token));

    // Verify DB snapshot
    const { data: txNoCoupon } = await admin
      .from("payment_transactions")
      .select("amount,metadata")
      .eq("public_reference", rNoCoupon.json?.merchant_oid)
      .single();
    check(`DB amount = ${expNoCoupon.finalTotal}`, Number(txNoCoupon?.amount) === expNoCoupon.finalTotal);
    check(`DB metadata.subtotal_kurus = ${expNoCoupon.subtotalKurus}`, txNoCoupon?.metadata?.subtotal_kurus === expNoCoupon.subtotalKurus);
    check("DB metadata.discount_kurus = 0", txNoCoupon?.metadata?.discount_kurus === 0);
    check(`DB metadata.final_total_kurus = ${expNoCoupon.finalTotalKurus}`, txNoCoupon?.metadata?.final_total_kurus === expNoCoupon.finalTotalKurus);

    // -------------------------------------------------------------
    // Test 3: Edge Function — 10% Discount Coupon
    // -------------------------------------------------------------
    console.log("\n[3] Edge Function: %10 İndirim Kuponu");
    const r10 = await callCreateToken(accessToken, { couponCode: CODE_10 });
    check("%10 Kuponlu oturum açıldı", r10.json?.success === true);
    check(`%10 Kuponlu final_amount = ${exp10.finalTotal} TL`, r10.json?.final_amount === exp10.finalTotal);
    check("%10 Kuponlu yeni merchant_oid üretildi", r10.json?.merchant_oid !== rNoCoupon.json?.merchant_oid);

    const { data: tx10 } = await admin
      .from("payment_transactions")
      .select("amount,metadata")
      .eq("public_reference", r10.json?.merchant_oid)
      .single();
    check(`DB amount = ${exp10.finalTotal}`, Number(tx10?.amount) === exp10.finalTotal);
    check(`DB metadata.subtotal_kurus = ${exp10.subtotalKurus}`, tx10?.metadata?.subtotal_kurus === exp10.subtotalKurus);
    check(`DB metadata.discount_kurus = ${exp10.discountKurus}`, tx10?.metadata?.discount_kurus === exp10.discountKurus);
    check(`DB metadata.final_total_kurus = ${exp10.finalTotalKurus}`, tx10?.metadata?.final_total_kurus === exp10.finalTotalKurus);
    check("DB metadata.coupon_code = " + CODE_10, tx10?.metadata?.coupon_code === CODE_10);

    // -------------------------------------------------------------
    // Test 4: Edge Function — Fixed 500 TL Coupon
    // -------------------------------------------------------------
    console.log("\n[4] Edge Function: 500 TL Sabit İndirim Kuponu");
    const rFixed = await callCreateToken(accessToken, { couponCode: CODE_FIXED });
    check("Sabit indirimli oturum açıldı", rFixed.json?.success === true);
    check(`Sabit indirimli final_amount = ${expFixed.finalTotal} TL`, rFixed.json?.final_amount === expFixed.finalTotal);

    const { data: txFixed } = await admin
      .from("payment_transactions")
      .select("amount,metadata")
      .eq("public_reference", rFixed.json?.merchant_oid)
      .single();
    check(`DB amount = ${expFixed.finalTotal}`, Number(txFixed?.amount) === expFixed.finalTotal);
    check(`DB metadata.discount_kurus = ${expFixed.discountKurus}`, txFixed?.metadata?.discount_kurus === expFixed.discountKurus);
    check(`DB metadata.final_total_kurus = ${expFixed.finalTotalKurus}`, txFixed?.metadata?.final_total_kurus === expFixed.finalTotalKurus);

    // -------------------------------------------------------------
    // Test 5: Edge Function — Invalid Coupon Rejection
    // -------------------------------------------------------------
    console.log("\n[5] Edge Function: Geçersiz Kupon Reddi");
    const rInvalid = await callCreateToken(accessToken, { couponCode: "SAHTEKUPON999" });
    check("Geçersiz kupon reddedildi (400)", rInvalid.status === 400);
    check("Hata kodu INVALID_COUPON", rInvalid.json?.error_code === "INVALID_COUPON");
    check("Sahte indirimle token üretilmedi", !rInvalid.json?.iframe_token);

    // -------------------------------------------------------------
    // Test 6: Edge Function — Expired Coupon Rejection
    // -------------------------------------------------------------
    console.log("\n[6] Edge Function: Süresi Dolmuş Kupon Reddi");
    const rExpired = await callCreateToken(accessToken, { couponCode: CODE_EXPIRED });
    check("Süresi dolmuş kupon reddedildi (400)", rExpired.status === 400);
    check("Hata kodu INVALID_COUPON", rExpired.json?.error_code === "INVALID_COUPON");

    // -------------------------------------------------------------
    // Test 7: Client Tamper Protection (Client sends fake price/discount)
    // -------------------------------------------------------------
    console.log("\n[7] Client Tamper Koruması: İstemciden Gelen Tutar İhmal Edilmeli");
    const rTamper = await callCreateToken(accessToken, {
      amount: 1,
      final_amount: 1,
      discount_amount: 2699,
      paymentAmount: "100",
    });
    check("İstemci sahte tutar gönderse de oturum açılır", rTamper.json?.success === true);
    check(`Sunucu yetkili fiyatı hesaplar (${packagePrice} TL, asla 1 TL değil)`, rTamper.json?.final_amount === packagePrice);

    const { data: txTamper } = await admin
      .from("payment_transactions")
      .select("amount")
      .eq("public_reference", rTamper.json?.merchant_oid)
      .single();
    check(`DB transaction tutarı ${packagePrice}.00 TL (tamper korumalı)`, Number(txTamper?.amount) === packagePrice);

    // -------------------------------------------------------------
    // Test 8: Session Invalidation on Coupon Change / Remove
    // -------------------------------------------------------------
    console.log("\n[8] Oturum İptali: Kupon Değişikliğinde Eski Oturum İptal Edilmeli");
    // Change from no coupon back to 10%
    const rRe10 = await callCreateToken(accessToken, { couponCode: CODE_10 });
    check("Kupon değişince yeni merchant_oid üretildi", rRe10.json?.merchant_oid !== rTamper.json?.merchant_oid);
    check(`Yeni tutar ${exp10.finalTotal} TL`, rRe10.json?.final_amount === exp10.finalTotal);

    // Remove coupon (couponCode null/omitted)
    const rRemoved = await callCreateToken(accessToken, { couponCode: null });
    check("Kupon kaldırılınca yeni merchant_oid üretildi", rRemoved.json?.merchant_oid !== rRe10.json?.merchant_oid);
    check(`Tutar tekrar tam fiyata (${expNoCoupon.finalTotal} TL) döndü`, rRemoved.json?.final_amount === expNoCoupon.finalTotal);

    // -------------------------------------------------------------
    // Test 9: PayTR Callback Exact Amount Consistency
    // -------------------------------------------------------------
    console.log("\n[9] PayTR Callback: Tutar Tutarlılığı & Mismatch Koruması");
    const rForCallback = await callCreateToken(accessToken, { couponCode: CODE_10 });
    const merchantOid = rForCallback.json?.merchant_oid;
    const expectedFinal = exp10.finalTotal;
    const expectedFinalKurus = exp10.finalTotalKurus;

    // Test 9a: Amount mismatch (PayTR reports wrong amount)
    const fakeWrongAmount = expectedFinal + 500;
    const { data: mismatchResult } = await admin.rpc("finalize_paytr_payment", {
      p_merchant_oid: merchantOid,
      p_status: "success",
      p_total_amount: fakeWrongAmount,
      p_paytr_payload: { payment_amount: (fakeWrongAmount * 100).toString() },
      p_payment_amount: fakeWrongAmount,
    });
    check("Tutar uyumsuzluğunda callback reddedildi", mismatchResult?.success === false);
    check("Hata kodu AMOUNT_MISMATCH", mismatchResult?.error_code === "AMOUNT_MISMATCH");

    // Test 9b: Exact match (PayTR reports correct discounted amount)
    const { data: matchResult } = await admin.rpc("finalize_paytr_payment", {
      p_merchant_oid: merchantOid,
      p_status: "success",
      p_total_amount: expectedFinal,
      p_paytr_payload: { payment_amount: expectedFinalKurus.toString() },
      p_payment_amount: expectedFinal,
    });
    check(`Doğru indirimli tutarla (${expectedFinal} TL) callback onaylandı`, matchResult?.success === true);
    check("İşlem statüsü 'paid' oldu", matchResult?.status === "paid");

    // Test 9c: Duplicate callback replay (idempotency check)
    const { data: replayResult } = await admin.rpc("finalize_paytr_payment", {
      p_merchant_oid: merchantOid,
      p_status: "success",
      p_total_amount: expectedFinal,
      p_paytr_payload: { payment_amount: expectedFinalKurus.toString() },
      p_payment_amount: expectedFinal,
    });
    check("Tekrar eden callback güvenle ele alındı (already_paid)", replayResult?.already_paid === true);
  } catch (error) {
    failures.push("Beklenmeyen hata: " + error.message);
    console.error("  FAIL  Beklenmeyen hata:", error.message);
  } finally {
    await cleanup();
  }

  console.log("\n----------------------------------------");
  console.log(`Geçen: ${passed}  Kalan: ${failures.length}`);
  if (failures.length) {
    console.log("\nBAŞARISIZ OLANLAR:");
    failures.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("Kupon & PayTR finansal tutarlılık testi BAŞARIYLA TAMAMLANDI.");
})();
