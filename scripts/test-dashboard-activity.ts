// Genel Bakış "Son Etkinlikler" zenginleştirme testleri (sahte istemci; ağ / veritabanı yok).
// Çalıştırma: npm run test:dashboard:activity
import { enrichRecentActivity, type RecentAuditRow } from "@/lib/admin/dashboard";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, info?: unknown) {
  if (ok) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${info === undefined ? "" : ` — ${JSON.stringify(info)}`}`);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const STUDENT_A = id(1);
const STUDENT_B = id(2);
const STUDENT_C = id(3);
const ADMIN = id(10);
const LESSON = id(20);
const PURCHASE = id(30);
const PAYMENT = id(40);

// PostgREST gibi: uuid kolona uuid olmayan değer gelirse tüm sorgu 22P02 ile reddedilir.
const UUID_COLUMNS: Record<string, string[]> = {
  student_lessons: ["id"],
  student_package_purchases: ["id"],
  payment_transactions: ["id"],
  student_profiles: ["id"],
  admin_profiles: ["user_id"],
};

const DB: Record<string, Record<string, unknown>[]> = {
  student_lessons: [{ id: LESSON, student_user_id: STUDENT_A }],
  student_package_purchases: [{ id: PURCHASE, student_user_id: STUDENT_B, package_id: "pkg10", lesson_count: 10 }],
  payment_transactions: [
    { id: PAYMENT, public_reference: "ORI1234567890", student_user_id: null, package_owner_student_id: STUDENT_C },
  ],
  student_profiles: [
    { id: STUDENT_A, full_name: "Ali Demir" },
    { id: STUDENT_B, full_name: "Can Yılmaz" },
    { id: STUDENT_C, full_name: "Ece Kaya" },
  ],
  admin_profiles: [{ user_id: ADMIN, display_name: "Yönetici" }],
  pricing_packages: [{ id: "pkg10", name_tr: "10 Derslik Paket", name_en: null }],
};

interface Call { table: string; column: string; values: string[]; rejected: boolean }

function fakeClient(options: { failTable?: string } = {}) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          return {
            in(column: string, values: string[]) {
              const rejected = (UUID_COLUMNS[table] ?? []).includes(column) && values.some((value) => !UUID.test(value));
              calls.push({ table, column, values, rejected });
              if (rejected) return Promise.resolve({ data: null, error: { code: "22P02", message: "invalid input syntax for type uuid" } });
              if (options.failTable === table) return Promise.resolve({ data: null, error: { message: "network" } });
              return Promise.resolve({ data: (DB[table] ?? []).filter((row) => values.includes(String(row[column]))), error: null });
            },
          };
        },
      };
    },
  };
  return { client: client as unknown as Parameters<typeof enrichRecentActivity>[0], calls };
}

let seq = 0;
function row(partial: Partial<RecentAuditRow>): RecentAuditRow {
  seq += 1;
  return {
    id: seq,
    action: "lesson.created_past",
    actor_user_id: null,
    category: "lesson",
    correlation_id: null,
    created_at: new Date(Date.UTC(2026, 9, 7, 12, 0, 0) - seq * 60_000).toISOString(),
    entity_id: null,
    entity_type: "student_lesson",
    metadata: {},
    severity: "info",
    ...partial,
  } as RecentAuditRow;
}
const meta = (r: RecentAuditRow) => (r.metadata ?? {}) as Record<string, unknown>;

async function main() {
console.log("dashboard recent activity");

// Gerçek üretim karışımı: ödeme satırı entity_id = public_reference (uuid değil).
const mixed = [
  row({ action: "lesson.created_past", entity_type: "student_lesson", entity_id: LESSON, actor_user_id: ADMIN }),
  row({ action: "payment_status_paid", category: "payment", entity_type: "payment_transaction", entity_id: "ORI1234567890", metadata: { public_reference: "ORI1234567890" } }),
  row({ action: "package.assigned", category: "package", entity_type: "student_package_purchase", entity_id: PURCHASE, metadata: { transaction_id: "ORI1234567890" } }),
  row({ action: "auth.login", category: "auth", entity_type: "user", entity_id: STUDENT_A, actor_user_id: STUDENT_A }),
  row({ action: "student.created", category: "student", entity_type: "student_profiles", entity_id: id(99), actor_user_id: ADMIN, metadata: { student_id: STUDENT_B } }),
];
{
  const { client, calls } = fakeClient();
  const out = await enrichRecentActivity(client, mixed);
  check("NO REJECTED QUERY: uuid kolona public_reference gitmez", calls.every((call) => !call.rejected), calls.filter((call) => call.rejected));
  check("RENDERS: ders satırı öğrenci adı", meta(out[0]).student_name === "Ali Demir", meta(out[0]));
  check("PAYMENT EVENT: public_reference → öğrenci", meta(out[1]).student_name === "Ece Kaya" && meta(out[1]).resolved_student_id === STUDENT_C, meta(out[1]));
  check("PACKAGE EVENT: paket adı + öğrenci", meta(out[2]).package_name === "10 Derslik Paket" && meta(out[2]).student_name === "Can Yılmaz", meta(out[2]));
  check("AUTH EVENT: kullanıcı çözülür", meta(out[3]).student_name === "Ali Demir", meta(out[3]));
  check("STUDENT EVENT: metadata.student_id → ad", meta(out[4]).student_name === "Can Yılmaz", meta(out[4]));
  check("ACTOR: yönetici adı", meta(out[0]).actor_name === "Yönetici", meta(out[0]));
  check("PAYMENT by reference uses public_reference column", calls.some((call) => call.table === "payment_transactions" && call.column === "public_reference" && call.values.includes("ORI1234567890")));
  check("DATE ORDER korunur (yeni → eski)", out.map((item) => item.id).join() === mixed.map((item) => item.id).join()
    && out.every((item, index) => index === 0 || out[index - 1].created_at >= item.created_at));
  check("INPUT METADATA mutasyona uğramaz", Object.keys(meta(mixed[0])).length === 0);
}

{
  const { client } = fakeClient();
  const [out] = await enrichRecentActivity(client, [row({ entity_type: "student_lesson", entity_id: id(777), actor_user_id: null })]);
  check("NULL ACTOR: hata yok, sahte isim yok", meta(out).actor_name === undefined);
  check("NULL SUBJECT (silinmiş ders): sahte öğrenci yok", meta(out).student_name === undefined && meta(out).resolved_student_id === undefined, meta(out));
}

{
  const { client, calls } = fakeClient();
  const [out] = await enrichRecentActivity(client, [row({ entity_type: "student_profile", entity_id: null, metadata: { student_id: "not-a-uuid" }, actor_user_id: "system" })]);
  check("BAD IDS: uuid olmayan öğrenci / aktör sorguya girmez", calls.every((call) => !call.rejected) && meta(out).student_name === undefined, calls);
}

{
  const { client } = fakeClient({ failTable: "student_profiles" });
  let threw = false;
  let out: RecentAuditRow[] = [];
  try {
    out = await enrichRecentActivity(client, mixed);
  } catch {
    threw = true;
  }
  check("LOOKUP FAILURE: liste yine döner (ad yok, kırılma yok)", !threw && out.length === mixed.length && meta(out[0]).student_name === undefined && meta(out[0]).resolved_student_id === STUDENT_A);
}

{
  const secretRow = row({
    action: "payment_status_failed", category: "payment", entity_type: "payment_transaction", entity_id: "ORI1234567890",
    metadata: { failed_reason_code: "51" },
  });
  const { client, calls } = fakeClient();
  const [out] = await enrichRecentActivity(client, [secretRow]);
  const added = Object.keys(meta(out)).filter((key) => !(key in meta(secretRow)));
  check("SANITIZATION: yalnız güvenli bağlam alanları eklenir", added.every((key) => ["student_name", "resolved_student_id", "actor_name", "package_name"].includes(key)), added);
  check("SANITIZATION: gizli kolon okunmaz", calls.every((call) => !/token|secret|password|card|hash/i.test(call.column)));
}

{
  const { client, calls } = fakeClient();
  check("EMPTY: sorgu yok", (await enrichRecentActivity(client, [])).length === 0 && calls.length === 0);
}

{
  const many = Array.from({ length: 100 }, (_, index) => row(index % 2
    ? { entity_type: "student_lesson", entity_id: id(1000 + index), actor_user_id: ADMIN }
    : { category: "payment", entity_type: "payment_transaction", entity_id: `ORI${String(index).padStart(10, "0")}`, metadata: { transaction_id: id(2000 + index) } }));
  const small = fakeClient();
  await enrichRecentActivity(small.client, many.slice(0, 4));
  const large = fakeClient();
  await enrichRecentActivity(large.client, many);
  check("NO N+1: 100 satırda sorgu sayısı sabit (≤ 7)", large.calls.length <= 7 && large.calls.length === small.calls.length, { small: small.calls.length, large: large.calls.length });
}

console.log(`dashboard recent activity: ${pass} PASS, ${fail} FAIL`);
if (fail) process.exit(1);
}

void main();
