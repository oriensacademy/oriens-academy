/**
 * Paket / ders / ders hakkı ve PayTR ödeme başlatma değişmezleri.
 *
 * Bu takım üç katmanı birden doğrular:
 *   1) ÜRETİM VERİTABANI  -- fonksiyon aşırı yüklemesi (overload) yok, kanonik
 *      imzalarda p_send_email yok, manuel bildirim RPC'si var, negatif hak ve
 *      iade edilmiş paket korumaları çalışıyor.
 *   2) EDGE FUNCTION KAYNAĞI -- outbox renderer yeni manuel şablonları tanıyor,
 *      paytr-create-token tek kullanımlık token'ı körlemesine yeniden servis
 *      etmiyor.
 *   3) ADMIN ARAYÜZ KAYNAĞI -- otomatik e-posta vaadi veren eski metinler ve
 *      Unicode emoji kalmadı, manuel gönderim butonları yerinde.
 *
 * Hiçbir e-posta gönderilmez, hiçbir kalıcı kayıt bırakılmaz.
 *
 *   node scripts/test-package-lesson-flow-invariants.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
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
const read = (rel) => readFileSync(path.resolve(process.cwd(), rel), "utf8");
/** Yorum satırları belge amaçlıdır; davranış iddiaları yalnızca gerçek kod üzerinde kurulur. */
const stripSqlComments = (src) => src.replace(/^\s*--.*$/gm, "");
const stripJsComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** PostgREST, bilinmeyen parametre adı için PGRST202 döndürür. */
async function rpcParamAccepted(fn, params) {
  const { error } = await admin.rpc(fn, params);
  if (!error) return true;
  return error.code !== "PGRST202";
}

async function section1_database() {
  console.log("\n[1] Üretim veritabanı");

  const { data: dups, error: dupError } = await admin.rpc("admin_list_duplicate_functions");
  check("admin_list_duplicate_functions çağrılabiliyor", !dupError, dupError?.message);

  const appDups = (dups || []).filter(
    (row) =>
      // levenshtein* pg_trgm/fuzzystrmatch eklentisinden gelir, uygulama kodu değildir.
      !String(row.function_name).startsWith("levenshtein") &&
      // admin_update_student_profile bilinçli olarak iki imzalıdır ve parametre
      // ADLARI farklıdır, bu yüzden PostgREST belirsizliğe düşmez.
      row.function_name !== "admin_update_student_profile"
  );
  check("uygulama fonksiyonlarında aşırı yükleme yok", appDups.length === 0, JSON.stringify(appDups));

  for (const fn of [
    "admin_record_completed_lesson",
    "admin_complete_student_lesson",
    "admin_complete_scheduled_event",
    "admin_adjust_package_lesson_rights",
    "admin_add_extra_lessons",
    "admin_adjust_package_lessons",
    "admin_create_booking",
    "enqueue_email_notification",
  ]) {
    const present = (dups || []).some((row) => row.function_name === fn);
    check(`${fn} tek imzalı`, !present);
  }

  // p_send_email kanonik imzalardan kaldırıldı.
  const zero = "00000000-0000-0000-0000-000000000000";
  check(
    "admin_record_completed_lesson p_send_email KABUL ETMİYOR",
    !(await rpcParamAccepted("admin_record_completed_lesson", {
      p_student_id: zero,
      p_lesson_title: "x",
      p_lesson_date: "2026-01-01",
      p_duration_minutes: 60,
      p_teacher_note: null,
      p_package_purchase_id: null,
      p_completion_source: "past",
      p_idempotency_key: "invariant-probe",
      p_send_email: false,
    }))
  );
  check(
    "admin_complete_student_lesson p_send_email KABUL ETMİYOR",
    !(await rpcParamAccepted("admin_complete_student_lesson", {
      p_lesson_id: zero,
      p_package_purchase_id: null,
      p_teacher_note: null,
      p_send_email: false,
    }))
  );

  // Manuel bildirim RPC'si mevcut ve admin dışı çağrıyı reddediyor.
  const { error: manualError } = await admin.rpc("admin_send_package_notification", {
    p_purchase_id: zero,
    p_kind: "package_assigned",
  });
  check("admin_send_package_notification mevcut", manualError?.code !== "PGRST202", manualError?.message);

  const { data: kindResult } = await admin.rpc("admin_send_package_notification", {
    p_purchase_id: zero,
    p_kind: "bogus_kind",
  });
  // service_role is_admin() değilse ADMIN_REQUIRED yükselir; o da geçerli bir korumadır.
  check(
    "geçersiz bildirim türü reddediliyor",
    kindResult == null || kindResult.success === false,
    JSON.stringify(kindResult)
  );
}

async function section2_migrationGuards() {
  console.log("\n[2] Migration korumaları (negatif hak / iade edilmiş paket)");
  const sql = read("supabase/migrations/20260906120000_canonical_completion_and_manual_package_mail.sql");

  check("kanonik admin_record_completed_lesson yeniden oluşturuluyor", sql.includes("admin_record_completed_lesson"));
  check("kanonik imzada p_send_email yok", !/p_send_email/.test(stripSqlComments(sql)));
  check("negatif ders hakkı engelleniyor", /NEGATIVE_LESSON_RIGHTS|lessons_used|greatest\(0/.test(sql));
  check("iade edilmiş / iade bekleyen paket engelleniyor", /refund_pending/.test(sql) && /refunded/.test(sql));
  check("manuel bildirim RPC'si tanımlı", sql.includes("admin_send_package_notification"));
  check("60 saniyelik çift gönderim baskılaması var", /60 seconds/.test(sql));
  check("doğrulanmamış hesap sahibine gönderim yok", /email_verified_at is not null/.test(sql));

  const dropSql = read("supabase/migrations/20260906130000_drop_remaining_rpc_overloads.sql");
  for (const fn of ["admin_add_extra_lessons", "admin_adjust_package_lessons", "admin_adjust_package_lesson_rights", "admin_create_booking"]) {
    check(`${fn} eski imzası düşürülüyor`, dropSql.includes(`drop function if exists public.${fn}(`));
  }
}

function section3_outbox() {
  console.log("\n[3] Outbox renderer");
  const src = read("supabase/functions/process-notification-outbox/index.ts");

  check("package_assigned_manual şablonu tanınıyor", src.includes('row.template === "package_assigned_manual"'));
  check("lesson_rights_manual şablonu tanınıyor", src.includes('row.template === "lesson_rights_manual"'));
  check("desteklenmeyen şablon hâlâ hata veriyor", src.includes("UNSUPPORTED_OUTBOX_TEMPLATE"));

  const manualBlock = src.slice(src.indexOf('row.template === "package_assigned_manual"'));
  check("manuel şablonlar hesap sahibi adını kullanıyor", manualBlock.includes("account_holder_name"));
  check("manuel hak şablonu toplam kalan hakkı yazıyor", manualBlock.includes("total_remaining_lessons"));
  check(
    "sıfır hakta fiyat sayfasına yönlendirme var",
    src.includes('row.template === "lesson_rights_manual" && Number(p.total_remaining_lessons ?? 0) === 0')
  );
}

function section4_paytr() {
  console.log("\n[4] PayTR ödeme oturumu (tek kullanımlık token)");
  const src = read("supabase/functions/paytr-create-token/index.ts");

  check("token yeniden kullanım penceresi tanımlı", src.includes("TOKEN_REUSE_WINDOW_MS"));
  check("pencere 90 saniye", /TOKEN_REUSE_WINDOW_MS\s*=\s*90 \* 1000/.test(src));
  check("token yaşı kaydediliyor", src.includes("iframe_token_issued_at"));
  check("tazelik kontrolü uygulanıyor", src.includes("isReusableToken"));
  check(
    "koşulsuz token yeniden servisi kaldırıldı",
    !src.includes('if (existingTx && (existingTx.metadata as Record<string, unknown>)?.iframe_token)')
  );
  check("bayat oturum arşivleniyor", src.includes('superseded_reason: "paytr_token_single_use"'));
  check("bayat oturum statüsü pending kalıyor (callback bozulmaz)", !/is_archived: true, status: "cancelled"/.test(src));
  check("yarış durumunda taze oturum isteniyor", src.includes("PAYMENT_SESSION_RETRY"));

  const panel = read("src/components/payment/HostedCardPanel.tsx");
  check("istemci PAYMENT_SESSION_RETRY'i bir kez yeniden deniyor", panel.includes('result.errorCode === "PAYMENT_SESSION_RETRY"'));
  check("kullanıcıya yeni oturum başlatma butonu var", panel.includes("Yeni Ödeme Oturumu Başlat"));
  check("iframe kaydırması engellenmiyor", !stripJsComments(panel).includes('scrolling="no"'));
  check("iframeResizer yükleniyor", panel.includes("iframeResizer.min.js"));

  const errors = read("src/lib/payments/public-errors.ts");
  check("PAYMENT_SESSION_RETRY kullanıcı metni var", errors.includes("PAYMENT_SESSION_RETRY"));
}

function section5_adminUi() {
  console.log("\n[5] Admin arayüzü (manuel gönderim, eski metin ve emoji temizliği)");
  const manager = read("src/components/admin/StudentLearningManager.tsx");
  const sheet = read("src/components/admin/StudentDetailSheet.tsx");
  const lib = read("src/lib/admin/student-learning.ts");

  check("paket bilgilendirme butonu var", manager.includes('sendPackageMail(p.id, "package_assigned")'));
  check("ders hakkı bilgilendirme butonu var", manager.includes('sendPackageMail(p.id, "lesson_rights")'));
  check("istemci yardımcısı tanımlı", lib.includes("export async function sendPackageNotificationEmail"));
  check("ham veritabanı hatası kullanıcıya gösterilmiyor", lib.includes("[admin/package-notification] RPC error:"));

  check("otomatik outbox vaadi kaldırıldı", !manager.includes("otomatik olarak işleme alınır"));
  check("'Ders hakkınız güncellendi' vaadi kaldırıldı", !sheet.includes("Ders hakkınız güncellendi&quot;</strong> başlığıyla"));
  check("otomatik MAIL-040 vaadi kaldırıldı", !/MAIL-040\) (gönderilir|gönderilecektir|gönderildi)/.test(sheet));

  for (const [name, src] of [["StudentLearningManager", manager], ["StudentDetailSheet", sheet]]) {
    check(`${name}: 📧 emoji yok`, !src.includes("\u{1F4E7}"));
    check(`${name}: Lucide Mail ikonu kullanılıyor`, src.includes("<Mail "));
    check(`${name}: p_send_email göndermiyor`, !src.includes("p_send_email"));
  }

  check("completeStudentLesson sendEmail parametresi almıyor", !/completeStudentLesson\(input: \{[^}]*sendEmail/s.test(lib));
  check("recordCompletedLesson sendEmail parametresi almıyor", !/p_send_email/.test(lib.replace(/^ \*.*$/gm, "")));

  const liveLesson = read("supabase/functions/send-live-lesson-email/index.ts");
  const completeBlock = liveLesson.split('action === "complete_lesson"')[1]?.split('action === "package_assigned"')[0] || "";
  check("complete_lesson artık e-posta göndermiyor", !completeBlock.includes("sendEmail"));
}

(async () => {
  console.log("=== Paket / Ders / Ders Hakkı + Ödeme Değişmezleri ===");
  await section1_database();
  await section2_migrationGuards();
  section3_outbox();
  section4_paytr();
  section5_adminUi();

  console.log("\n----------------------------------------");
  console.log(`Geçen: ${passed}  Kalan: ${failures.length}`);
  if (failures.length) {
    console.log("\nBAŞARISIZ:");
    failures.forEach((f) => console.log("  - " + f));
    process.exit(1);
  }
  console.log("Tüm değişmezler doğrulandı.");
})();
