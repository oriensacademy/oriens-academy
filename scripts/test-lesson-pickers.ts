import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { canonicalDateToDisplay, displayDateToCanonical, LESSON_CALENDAR_WEEKDAYS, LESSON_MINUTE_OPTIONS, withDefaultLessonMinute } from "../src/components/admin/ControlledLessonDateTime";

const picker = readFileSync("src/components/admin/ControlledLessonDateTime.tsx", "utf8");
const manager = readFileSync("src/components/admin/StudentLearningManager.tsx", "utf8");
const refDialogs = readFileSync("src/components/admin/StudentRefDialogs.tsx", "utf8");

// Referans tarih biçimi GG.AA.YYYY (DD.MM.YYYY).
assert.equal(canonicalDateToDisplay("2026-09-21"), "21.09.2026");
assert.equal(displayDateToCanonical("21.09.2026"), "2026-09-21");
assert.equal(displayDateToCanonical("31.02.2026"), null);
assert.deepEqual([...LESSON_CALENDAR_WEEKDAYS], ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]);
assert.match(picker, /const mondayOffset = \(first\.getDay\(\) \+ 6\) % 7/);
assert.match(picker, /data-week-start="monday"/);
assert.equal((picker.match(/aria-haspopup="dialog"/g) || []).length, 2);
assert.equal((picker.match(/role="dialog"/g) || []).length, 2);
assert.doesNotMatch(picker, /inputMode|type="date"|type="time"|AM\/PM/);
assert.match(picker, /Array\.from\(\{ length: 24 \}/);
assert.deepEqual([...LESSON_MINUTE_OPTIONS], ["00", "15", "30", "45"]);
assert.equal(withDefaultLessonMinute("20:37"), "20:00");
assert.doesNotMatch(picker, /Array\.from\(\{ length: 60 \}/);
assert.match(picker, /`\$\{hour\}:\$\{minute\}`/);

assert.match(manager, /Yapılan ders tarihi GG\.AA\.YYYY/);
assert.match(manager, /Gelecek ders tarihi GG\.AA\.YYYY/);
assert.match(manager, /Tamamlanmış ders tarihi GG\.AA\.YYYY/);
// Referans pencereleri (Yapılan ders, Dersi Düzenle, Yeni Paket Tanımla)
// referans tarih/saat seçicilerini kullanır; ödeme tarihi #pk-tarih.
assert.match(refDialogs, /<RefDatePicker id=\{`\$\{p\}-tarih`\}/);
assert.match(refDialogs, /<RefTimeSelect /);
assert.match(refDialogs, /<RefDatePicker id="pk-tarih"/);
assert.doesNotMatch(refDialogs, /type="date"|type="time"/);
assert.match(manager, /Başlangıç saati HH:mm/);
assert.match(manager, /Gelecek ders başlangıç saati HH:mm/);
assert.doesNotMatch(manager, /DD\/MM\/YYYY/);
assert.equal((manager.match(/<ControlledLessonDate/g) || []).length, 3);
assert.equal((manager.match(/<ControlledLessonTime/g) || []).length, 3);
assert.equal((manager.match(/localLessonDateTimeToUtc\(`\$\{/g) || []).length, 4);
assert.equal((manager.match(/startTime: withDefaultLessonMinute/g) || []).length, 2);

// Yönetim paneli genel taraması: menüden ulaşılan her admin sayfasının içe
// aktarma ağacında tarayıcının yerel tarih/saat seçicisi bulunmamalı.
// Menüde, başlık aramasında veya herhangi bir bağlantıda yer almayan eski
// rotalar (müsaitlik, randevular, ödevler, içerik) LEGACY olarak sınıflanır ve
// bu rotalara hiçbir aktif giriş noktası olmadığı ayrıca doğrulanır.
const ROOT = process.cwd();
const LEGACY_ROUTES = ["musaitlik", "randevular", "odevler", "icerik"];
const NATIVE = /type=["']?(date|time|datetime-local|month|week)["'}]/;

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importGraph(entries: string[]) {
  const seen = new Set<string>();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
      const resolved = resolveImport(file, match[1]);
      if (resolved && /\.(tsx?|jsx?)$/.test(resolved)) stack.push(resolved);
    }
  }
  return seen;
}

function adminPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return adminPages(full);
    return name === "page.tsx" || name === "layout.tsx" || name === "AdminClientLayout.tsx" ? [full] : [];
  });
}

const adminDir = path.join(ROOT, "src", "app", "admin");
const isLegacy = (file: string) => LEGACY_ROUTES.some((route) => file.startsWith(path.join(adminDir, route) + path.sep));
const activeEntries = adminPages(adminDir).filter((file) => !isLegacy(file));
const activeFiles = importGraph(activeEntries);
const nativeHits = [...activeFiles].filter((file) => NATIVE.test(readFileSync(file, "utf8"))).map((file) => path.relative(ROOT, file));
assert.deepEqual(nativeHits, [], `aktif admin akışlarında yerel tarih/saat seçicisi: ${nativeHits.join(", ")}`);
assert.ok(activeFiles.has(path.join(ROOT, "src", "components", "admin", "StudentDetailSheet.tsx")), "öğrenci detay sayfası taramada");
assert.ok(activeFiles.has(path.join(ROOT, "src", "components", "admin", "RefDatePicker.tsx")), "RefDatePicker aktif akışlarda kullanılıyor");

// LEGACY rotalara aktif dosyalardan bağlantı yok.
for (const file of activeFiles) {
  if (isLegacy(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const route of LEGACY_ROUTES) {
    assert.doesNotMatch(source, new RegExp(`["'\`]/admin/${route}`), `${path.relative(ROOT, file)} → /admin/${route}`);
  }
}
const legacyNative = adminPages(adminDir).filter(isLegacy).length;
console.log(`active admin files scanned: ${activeFiles.size}; active native date/time pickers: 0; legacy unlinked routes: ${LEGACY_ROUTES.join(", ")} (${legacyNative} pages)`);
console.log("lesson date/time picker invariants: PASS");
