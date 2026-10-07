// Final reconciliation invariants (§34 A–G).
// Ağ, gerçek e-posta ve gerçek veri kullanılmaz: Supabase istemcisi süreç içinde
// taklit edilir, fetch yakalanır. Çalıştırma:
//   TZ=Europe/Istanbul npx --yes tsx scripts/test-final-reconciliation.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { register } from "node:module";

process.env.TZ = process.env.TZ || "Europe/Istanbul";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mockref.supabase.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock-publishable-key";

// .css modül içe aktarımları Node'da çalışmaz; testte boş nesneye çevrilir.
register(
  "data:text/javascript," +
    encodeURIComponent(
      'export async function load(url, ctx, next) { if (url.endsWith(".css")) return { format: "module", source: "export default {};", shortCircuit: true }; return next(url, ctx); }'
    )
);
(Module as unknown as { _extensions: Record<string, (m: { exports: unknown }) => void> })._extensions[".css"] = (m) => {
  m.exports = {};
};

const read = (path: string) => readFileSync(path, "utf8");
const results: string[] = [];
const done = (name: string) => results.push(`${name}: PASS`);

// Her ağ isteği burada yakalanır; gerçek uç noktaya hiçbir şey gitmez.
const requests: { url: string; body: unknown }[] = [];
let fetchReply: (url: string) => { status: number; body: unknown } = () => ({ status: 500, body: { success: false } });
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  requests.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
  const reply = fetchReply(url);
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;

async function main() {
  const { getSupabaseClient } = await import("../src/lib/supabase/client");
  const client = getSupabaseClient() as unknown as Record<string, unknown> & { auth: Record<string, unknown> };
  client.auth.getSession = async () => ({ data: { session: { access_token: "mock-access-token" } }, error: null });
  client.auth.getUser = async () => ({ data: { user: { id: "00000000-0000-0000-0000-00000000a001" } }, error: null });

  // ---------------------------------------------------------------- A
  {
    const sql = read("supabase/migrations/20261006101000_guardian_lesson_instructor_names.sql");
    assert.match(sql, /security definer/i);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /returns table\(instructor_id uuid, display_name text\)/);
    assert.match(sql, /where auth\.uid\(\) is not null/);
    assert.match(sql, /gs\.active and ga\.active/);
    assert.match(sql, /not l\.is_archived/);
    assert.match(sql, /revoke all on function public\.get_guardian_lesson_instructor_names\(uuid\) from public, anon;/);
    assert.match(sql, /grant execute on function public\.get_guardian_lesson_instructor_names\(uuid\) to authenticated;/);
    for (const file of ["20261006100000_guardian_profile_phone_ten_digits.sql", "20261006101000_guardian_lesson_instructor_names.sql", "20261006102000_contact_settings_site_setting.sql", "20261006103000_auth_login_events.sql"]) {
      const body = read(`supabase/migrations/${file}`);
      assert.doesNotMatch(body, /create\s+policy[\s\S]{0,200}on\s+public\.instructors/i, `${file}: instructors policy`);
      assert.doesNotMatch(body, /grant\s+select\s+on\s+(table\s+)?public\.instructors/i, `${file}: instructors grant`);
    }
    assert.match(read("src/lib/student/data.ts"), /rpc\("get_guardian_lesson_instructor_names"/);
    done("A instructor access");
  }

  // ---------------------------------------------------------------- B
  {
    const { normalizeTrPhone, isCompleteTrPhone, trPhoneInputDigits, formatTrPhoneDisplay, formatTrPhoneInput } = await import("../src/lib/format/phone");
    for (const raw of ["+905333591962", "05333591962", "5333591962", "+90 533 359 19 62", "0 (533) 359 19 62"]) {
      assert.equal(normalizeTrPhone(raw), "5333591962", raw);
      assert.equal(trPhoneInputDigits(raw), "5333591962", raw);
    }
    assert.equal(normalizeTrPhone(""), null);
    assert.equal(normalizeTrPhone("   "), null);
    assert.equal(normalizeTrPhone(null), null);
    assert.equal(isCompleteTrPhone(normalizeTrPhone("53335")), false);
    assert.equal(isCompleteTrPhone(normalizeTrPhone("+905333591962")), true);
    assert.equal(isCompleteTrPhone("0533359196"), false);
    assert.equal(formatTrPhoneDisplay("05333591962"), "+90 533 359 19 62");
    assert.equal(formatTrPhoneInput("5333591962"), "(533) 359 19 62");
    const view = read("src/components/student/hesabim/HesabimView.tsx");
    assert.match(view, /Telefon numarasını eksiksiz yazın/);
    const migration = read("supabase/migrations/20261006100000_guardian_profile_phone_ten_digits.sql");
    // Tek UPDATE, RPC gövdesinde ve yalnız çağıranın satırı: toplu dönüştürme yok.
    const updates = migration.match(/update\s+public\.guardian_accounts[\s\S]*?;/gi) || [];
    assert.equal(updates.length, 1, "single scoped update");
    assert.match(updates[0] ?? "", /where user_id = auth\.uid\(\) and active;$/, "update scoped to caller");
    done("B phone normalize");
  }

  // ---------------------------------------------------------------- C
  {
    const { requestEmailChange, verifyEmailChangeOtp } = await import("../src/lib/student/auth");
    requests.length = 0;
    fetchReply = (url) => url.endsWith("/functions/v1/request-email-change")
      ? { status: 200, body: { success: true, new_email: "yeni@example.invalid", masked_new_email: "y***@example.invalid" } }
      : url.endsWith("/functions/v1/verify-email-change")
        ? { status: 200, body: { success: true, email: "yeni@example.invalid" } }
        : { status: 404, body: {} };
    const requested = await requestEmailChange("  Yeni@Example.invalid ", "tr");
    assert.equal(requested.success, true);
    assert.deepEqual(requests[0]?.body, { newEmail: "yeni@example.invalid", locale: "tr" });
    const verified = await verifyEmailChangeOtp("123456", "tr");
    assert.equal(verified.success, true);
    assert.equal(requests.length, 2);
    assert.ok(requests.every((r) => r.url.startsWith("https://mockref.supabase.invalid/")), "only mocked endpoint");
    fetchReply = () => ({ status: 400, body: { success: false, error_code: "INVALID_CODE", remaining_attempts: 4 } });
    const wrong = await verifyEmailChangeOtp("000000", "tr");
    assert.equal(wrong.success, false);
    const gate = read("src/components/auth/EmailOtpGate.tsx");
    assert.match(gate, /\/\^\\d\{6\}\$\/\.test\(code\)/);
    assert.match(gate, /maxLength=\{6\}/);
    const authSrc = read("src/lib/student/auth.ts");
    const changeFlow = authSrc.slice(authSrc.indexOf("export async function requestEmailChange"), authSrc.indexOf("\nexport ", authSrc.indexOf("export async function verifyEmailChangeOtp") + 10));
    assert.match(changeFlow, /functions\/v1\/verify-email-change/);
    assert.doesNotMatch(changeFlow, /signInWithOtp|emailRedirectTo|updateUser|magic/i, "email change: no magic / one-click link");
    done("C email change OTP (mocked)");
  }

  // ---------------------------------------------------------------- D
  {
    const { adminLedgerStatus, canRefundLedgerRow } = await import("../src/lib/admin/payments");
    assert.equal(adminLedgerStatus({ status: "paid", refund_status: "partial" } as never), "odendi");
    assert.equal(adminLedgerStatus({ status: "paid", refund_status: "full" } as never), "iade");
    assert.equal(adminLedgerStatus({ status: "refunded", refund_status: null } as never), "iade");
    assert.equal(adminLedgerStatus({ status: "failed", refund_status: null } as never), "basarisiz");
    assert.equal(adminLedgerStatus({ status: "pending", refund_status: null } as never), "bekliyor");
    const tx = { provider: "paytr", payment_method: "card", refund_status: null };
    const row = (patch: Record<string, unknown>) => ({ transaction: tx, source: "paytr", status: "odendi", netAmount: 1000, refundedAmount: 0, ...patch }) as never;
    assert.equal(canRefundLedgerRow(row({})), true);
    assert.equal(canRefundLedgerRow(row({ refundedAmount: 1000 })), false);
    assert.equal(canRefundLedgerRow(row({ source: "banka" })), false);
    assert.equal(canRefundLedgerRow(row({ status: "iade" })), false);
    assert.equal(canRefundLedgerRow(row({ transaction: { ...tx, payment_method: "bank_transfer" } })), false);
    assert.equal(canRefundLedgerRow(row({ transaction: null })), false);

    const { isoToLocalParts, localPartsToIso, couponDiscount } = await import("../src/components/admin/CouponDialog");
    // valid_from: yerel gün/saat korunur (UTC günü yerel gün sanılmaz).
    const iso = localPartsToIso("2026-10-07", "00:30");
    assert.equal(iso, "2026-10-06T21:30:00.000Z");
    assert.deepEqual(isoToLocalParts(iso), { day: "2026-10-07", time: "00:30" });
    assert.deepEqual(isoToLocalParts("2026-10-06T21:30:00.000Z"), { day: "2026-10-07", time: "00:30" });
    assert.equal(localPartsToIso("", "10:00"), null);
    assert.equal(couponDiscount(1000, "yuzde", 10, null), 100);
    assert.equal(couponDiscount(1000, "yuzde", 50, 200), 200);
    assert.equal(couponDiscount(1000, "sabit", 1500, null), 1000);
    assert.doesNotMatch(read("src/components/admin/CouponDialog.tsx"), /toISOString\(\)\.slice\(0, ?10\)/);
    done("D refund/coupon presentation");
  }

  // ---------------------------------------------------------------- E
  {
    const store = new Map<string, { value: unknown; is_public: boolean }>([
      ["contact.public", { value: { whatsapp: "+90 544 293 90 40", landline: "+90 850 304 04 67", email: "info@oriens-academy.com", address: "Emaar Square, The Heights E Blok, Üsküdar / İstanbul" }, is_public: true }],
    ]);
    const audits: unknown[] = [];
    client.from = (table: string) => {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> | null = null;
      const builder = {
        select: () => builder,
        update: (value: Record<string, unknown>) => { patch = value; return builder; },
        insert: async (value: unknown) => { if (table === "audit_logs") audits.push(value); return { data: null, error: null }; },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          if (patch && table === "site_settings") {
            const row = store.get(String(filters.key));
            if (!row) return Promise.resolve({ data: [], error: null });
            row.value = patch.value;
            return { select: async () => ({ data: [{ key: filters.key }], error: null }) };
          }
          return builder;
        },
        maybeSingle: async () => {
          const row = store.get(String(filters.key));
          return { data: row && (filters.is_public === undefined || row.is_public === filters.is_public) ? { value: row.value } : null, error: null };
        },
      };
      return builder;
    };
    const settings = await import("../src/lib/contact-settings");
    const before = await settings.fetchContactSettings();
    assert.equal(before.email, "info@oriens-academy.com");
    const next = { whatsapp: " +90 555 111 22 33 ", landline: "+90 850 304 04 67", email: "iletisim@example.invalid", address: "Yeni Adres Sok. No:1\nKadıköy / İstanbul" };
    const saved = await settings.saveContactSettings(next);
    assert.equal(saved.ok, true);
    const after = await settings.fetchContactSettings();
    assert.deepEqual(after, { whatsapp: "+90 555 111 22 33", landline: "+90 850 304 04 67", email: "iletisim@example.invalid", address: "Yeni Adres Sok. No:1\nKadıköy / İstanbul" });
    assert.equal(audits.length, 1);
    const site = settings.toSiteContactView(after);
    assert.equal(site.whatsappHref, "https://wa.me/905551112233");
    assert.deepEqual(site.businessAddressLines.tr, ["Yeni Adres Sok. No:1", "Kadıköy / İstanbul"]);
    const invalid = await settings.saveContactSettings({ ...next, email: "gecersiz" });
    assert.equal(invalid.ok, false);
    assert.equal((await settings.fetchContactSettings()).email, "iletisim@example.invalid", "invalid save does not persist");
    assert.doesNotMatch(read("src/lib/contact-settings.ts"), /localStorage\.(get|set)Item/);
    done("E contact settings persistence (mocked store)");
  }

  // ---------------------------------------------------------------- F
  {
    const { canonicalDateToDisplay, displayDateToCanonical, withDefaultLessonMinute, LESSON_MINUTE_OPTIONS } = await import("../src/components/admin/ControlledLessonDateTime");
    assert.equal(canonicalDateToDisplay("2026-10-07"), "07.10.2026");
    assert.equal(displayDateToCanonical("07.10.2026"), "2026-10-07");
    assert.equal(displayDateToCanonical("31.02.2026"), null);
    assert.equal(withDefaultLessonMinute("20:37"), "20:00");
    assert.deepEqual([...LESSON_MINUTE_OPTIONS], ["00", "15", "30", "45"]);
    const live = ["src/components/admin/StudentDetailSheet.tsx", "src/components/admin/StudentLearningManager.tsx", "src/components/admin/ReviewDialog.tsx", "src/components/admin/CouponDialog.tsx", "src/app/admin/iletisim/page.tsx", "src/app/admin/odemeler/page.tsx", "src/app/admin/mali-akis/page.tsx"];
    for (const file of live) {
      const src = read(file);
      assert.doesNotMatch(src, /type="(date|time|datetime-local)"/, `${file}: native picker`);
      assert.doesNotMatch(src, /new Date\(\)\.toISOString\(\)\.slice\(0, ?10\)/, `${file}: UTC day as local`);
    }
    const ref = read("src/components/admin/RefDatePicker.tsx");
    assert.doesNotMatch(ref, /toISOString/);
    done("F picker invariant");
  }

  // ---------------------------------------------------------------- G
  {
    const guard = read("src/components/admin/UnsavedChangesGuard.tsx");
    assert.match(read("src/components/admin/AdminShell.tsx"), /<UnsavedChangesGuard \/>/);
    assert.match(guard, /\[role="dialog"\]\[aria-modal="true"\]/);
    assert.match(guard, /\.dp-val, \[data-guard-val\]/);
    assert.match(guard, /\[data-guard-pick\]/);
    assert.match(guard, /Kaydetmeden kapat/);
    assert.match(read("src/components/admin/ControlledLessonDateTime.tsx"), /data-guard-val/);
    for (const file of ["src/components/admin/PricingPackageDialog.tsx", "src/components/admin/CouponDialog.tsx", "src/components/admin/ReviewDialog.tsx", "src/components/admin/ContactDialog.tsx"]) {
      assert.match(read(file), /role="dialog" aria-modal="true"/, file);
    }
    const sheet = read("src/components/admin/StudentDetailSheet.tsx");
    assert.match(sheet, /function EditStudentIdentityModal/);
    const manager = read("src/components/admin/StudentLearningManager.tsx");
    assert.ok((manager.match(/aria-modal=\{referenceMode \? "true" : undefined\}/g) || []).length >= 3, "learning modals aria-modal");
    assert.match(read("src/app/admin/ayarlar/page.tsx"), /usePageLeaveGuard\(dirty/);
    assert.match(read("src/components/admin/BlogEditorPage.tsx"), /usePageLeaveGuard/);
    // Çıkış doğrudan: ek onay penceresi yok.
    for (const file of ["src/components/admin/AdminHeader.tsx", "src/components/auth/AccountMenu.tsx", "src/components/sections/Navbar.tsx"]) {
      assert.doesNotMatch(read(file), /LogoutConfirmationModal/, file);
    }
    done("G unsaved guard + direct logout");
  }

  for (const line of results) console.log(line);
  console.log(`network requests (all mocked): ${requests.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
