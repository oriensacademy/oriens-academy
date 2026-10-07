import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const detail = readFileSync("src/components/admin/StudentDetailSheet.tsx", "utf8");
const students = readFileSync("src/lib/admin/students.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260921120000_student_grade_form_options.sql", "utf8");

const guardianForm = detail.slice(
  detail.indexOf("function GuardianStudentsSection"),
  detail.indexOf("function StudentGradeField")
);
const editForm = detail.slice(
  detail.indexOf("function EditStudentIdentityModal"),
  detail.indexOf("function RecordPastLessonModal")
);


for (const [name, source] of [["create/edit guardian form", guardianForm], ["student edit form", editForm]]) {
  assert.match(source, /StudentGradeField/, `${name}: Sınıf dropdown must be present`);
  assert.doesNotMatch(source, />Hedef Ülke</, `${name}: Hedef Ülke must be absent`);
  assert.doesNotMatch(source, />Hedef Üniversite</, `${name}: Hedef Üniversite must be absent`);
}

// Referans admin öğrenci detayında (oriens-admin_6.html) hedef ülke / üniversite
// alanı yok; bu tercihler müşterinin Hesabım > Akademik Hedefler bölümünde kalır.
assert.doesNotMatch(detail, /AKADEMİK PROFİL|Hedef Ülke|Hedef Üniversite/, "admin detail mirrors the reference (no target fields)");
assert.match(readFileSync("src/components/student/StudentPortal.tsx", "utf8"), /Hedef Üniversite \/ Bölüm/, "customer academic goals keep target university");
assert.match(detail, /Sınıf seçin/, "Grade dropdown placeholder must be present");
assert.match(detail, /Sınıfları yönet/, "Grade manager trigger must be present");

for (const action of ["create", "rename", "reorder", "deactivate", "activate"]) {
  assert.match(migration, new RegExp(`'${action}'`), `Grade manager must support ${action}`);
}
assert.match(migration, /grade_level text;/, "Nullable grade_level must be added");
assert.doesNotMatch(migration, /9\. Sınıf|10\. Sınıf|11\. Sınıf|12\. Sınıf|Hazırlık/, "Grade options must not be seeded");
assert.doesNotMatch(migration, /drop\s+column/i, "Migration must not drop columns");
assert.doesNotMatch(migration, /delete\s+from/i, "Migration must not delete data");

const formRpc = migration.slice(
  migration.indexOf("create or replace function public.admin_update_student_form_profile"),
  migration.indexOf("create or replace function public.admin_create_student_for_guardian_with_grade")
);
assert.doesNotMatch(formRpc, /target_country|target_countries|target_university/, "Form RPC must not read or write target fields");
assert.doesNotMatch(students.slice(students.indexOf("export async function adminUpdateStudentProfile"), students.indexOf("export type StudentGradeOption")), /p_target_|targetCountries|targetUniversity/, "Client update payload must not send target fields");

console.log("PASS student create/edit grade form invariants");
console.log("PASS target fields preserved by omission from form RPC contract");
console.log("PASS academic profile target display retained");
console.log("PASS grade manager add/rename/reorder/deactivate/reactivate contract");
