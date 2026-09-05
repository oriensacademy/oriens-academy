/**
 * PayTR ödeme oturumu canlı yaşam döngüsü testi.
 *
 * "Bu ödeme sayfası artık geçersiz. Lütfen yeni bir ödeme başlatın." hatasının
 * kök nedeni, TEK KULLANIMLIK PayTR iframe token'ının aynı sepet için 15 dakika
 * boyunca yeniden servis edilmesiydi. Bu takım, ÜRETİMDEKİ paytr-create-token
 * Edge Function'ını gerçek bir oturumla çağırarak şunları doğrular:
 *
 *   1. İlk çağrı gerçek bir PayTR token'ı üretir.
 *   2. Çift tıklama penceresinde (< 90 sn) AYNI token döner -- mükerrer ödeme
 *      oturumu ve mükerrer bekleyen kayıt oluşmaz.
 *   3. Pencere geçtikten sonra token ASLA tekrar servis edilmez: eski kayıt
 *      arşivlenir, kullanıcıya YENİ merchant_oid ve YENİ token verilir.
 *   4. Arşivlenen kayıt 'pending' kalır -- PayTR geri bildirimi (callback)
 *      merchant_oid ile bulup işleyebilir, yani eski sekmede yapılan gerçek bir
 *      ödeme kaybolmaz.
 *
 * Hiçbir ödeme çekilmez (yalnızca ödeme oturumu açılır) ve kurulan tüm fixture
 * kayıtları sonunda silinir.
 *
 *   node scripts/test-paytr-session-lifecycle.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

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
const FIXTURE_EMAIL = `paytr-lifecycle-${stamp}@oriens-academy-test.invalid`;
const FIXTURE_PASSWORD = `Pt!${stamp}aA9`;
const PACKAGE_ID = "single";

let guardianUserId = null;
let learnerId = null;
const createdReferences = [];

async function callCreateToken(accessToken) {
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
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (json?.merchant_oid) createdReferences.push(json.merchant_oid);
  return { status: res.status, json };
}

async function setup() {
  console.log("\n[0] Test hesabı kuruluyor");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "PayTR Yasam Dongusu Testi" },
  });
  if (createError) throw new Error("fixture kullanıcı oluşturulamadı: " + createError.message);
  guardianUserId = created.user.id;

  await admin.from("guardian_accounts").upsert({
    user_id: guardianUserId,
    email: FIXTURE_EMAIL,
    full_name: "PayTR Yasam Dongusu Testi",
    email_verified_at: new Date().toISOString(),
    active: true,
    preferred_language: "tr",
  });

  const { data: learner, error: learnerError } = await admin
    .from("student_profiles")
    .insert({ id: randomUUID(), full_name: "PayTR Test Ogrencisi", email: `learner-${stamp}@oriens-academy-test.invalid`, active: true })
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
  console.log("  test hesabı hazır:", FIXTURE_EMAIL);
  return session.session.access_token;
}

async function cleanup() {
  console.log("\n[4] Temizlik");
  if (createdReferences.length) {
    const { error } = await admin.from("payment_transactions").delete().in("public_reference", createdReferences);
    console.log("  ödeme kayıtları silindi:", createdReferences.length, error ? "HATA: " + error.message : "");
  }
  if (learnerId) {
    await admin.from("guardian_students").delete().eq("student_id", learnerId);
    await admin.from("student_profiles").delete().eq("id", learnerId);
  }
  if (guardianUserId) {
    await admin.from("guardian_accounts").delete().eq("user_id", guardianUserId);
    await admin.auth.admin.deleteUser(guardianUserId);
  }
  console.log("  fixture kayıtları kaldırıldı");
}

(async () => {
  console.log("=== PayTR Ödeme Oturumu Yaşam Döngüsü (canlı) ===");
  let accessToken;
  try {
    accessToken = await setup();
  } catch (error) {
    console.error("KURULUM BAŞARISIZ:", error.message);
    await cleanup();
    process.exit(1);
  }

  try {
    console.log("\n[1] İlk ödeme oturumu");
    const first = await callCreateToken(accessToken);
    check("ödeme oturumu açıldı", first.json?.success === true, `${first.status} ${JSON.stringify(first.json).slice(0, 300)}`);
    check("gerçek PayTR token'ı döndü", typeof first.json?.iframe_token === "string" && first.json.iframe_token.length > 10);
    check("merchant_oid üretildi", typeof first.json?.merchant_oid === "string" && first.json.merchant_oid.startsWith("ORI"));

    if (!first.json?.iframe_token) throw new Error("ilk token alınamadı, devam edilemiyor");

    console.log("\n[2] Çift tıklama penceresi (< 90 sn)");
    const second = await callCreateToken(accessToken);
    check("aynı token döndü (mükerrer oturum yok)", second.json?.iframe_token === first.json.iframe_token);
    check("aynı merchant_oid korundu", second.json?.merchant_oid === first.json.merchant_oid);
    check("yeniden kullanım işaretlendi", second.json?.reused_existing === true);

    const { data: pendingRows } = await admin
      .from("payment_transactions")
      .select("id")
      .eq("public_reference", first.json.merchant_oid);
    check("tek bir ödeme kaydı oluştu", (pendingRows || []).length === 1, String((pendingRows || []).length));

    console.log("\n[3] Pencere dolduktan sonra (tek kullanımlık token asla tekrar servis edilmez)");
    // Token'ın yaşını geriye alarak 90 saniyeyi beklemeden aynı durumu kurarız.
    const { data: row } = await admin
      .from("payment_transactions")
      .select("id,metadata")
      .eq("public_reference", first.json.merchant_oid)
      .single();
    await admin
      .from("payment_transactions")
      .update({
        metadata: { ...row.metadata, iframe_token_issued_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
      })
      .eq("id", row.id);

    const third = await callCreateToken(accessToken);
    check("yeni oturum açıldı", third.json?.success === true, JSON.stringify(third.json).slice(0, 300));
    check("YENİ token verildi (bayat token servis edilmedi)", third.json?.iframe_token && third.json.iframe_token !== first.json.iframe_token);
    check("YENİ merchant_oid verildi", third.json?.merchant_oid && third.json.merchant_oid !== first.json.merchant_oid);
    check("yeniden kullanım işareti yok", third.json?.reused_existing !== true);

    const { data: oldRow } = await admin
      .from("payment_transactions")
      .select("status,is_archived,metadata")
      .eq("public_reference", first.json.merchant_oid)
      .single();
    check("bayat oturum arşivlendi", oldRow?.is_archived === true);
    check("bayat oturum 'pending' kaldı (callback bozulmaz)", oldRow?.status === "pending", String(oldRow?.status));
    check("arşivleme nedeni kaydedildi", oldRow?.metadata?.superseded_reason === "paytr_token_single_use");
  } catch (error) {
    failures.push("beklenmeyen hata: " + error.message);
    console.log("  FAIL  beklenmeyen hata -- " + error.message);
  } finally {
    await cleanup();
  }

  console.log("\n----------------------------------------");
  console.log(`Geçen: ${passed}  Kalan: ${failures.length}`);
  if (failures.length) {
    console.log("\nBAŞARISIZ:");
    failures.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("PayTR ödeme oturumu yaşam döngüsü doğrulandı.");
})();
