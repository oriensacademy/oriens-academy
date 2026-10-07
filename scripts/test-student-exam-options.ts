import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sheet = readFileSync("src/components/admin/StudentDetailSheet.tsx", "utf8");
const manager = readFileSync("src/components/admin/StudentExamManagerModal.tsx", "utf8");
const api = readFileSync("src/lib/admin/students.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260924120000_student_exam_form_options.sql", "utf8");

assert.doesNotMatch(sheet, /Virgülle ayırın/);
assert.match(sheet, /function StudentExamField/);
assert.match(sheet, /onChange\(\[\.\.\.value, option\.label\]\)/);
assert.match(sheet, /value\.filter\(\(_, itemIndex\) => itemIndex !== index\)/);
assert.match(sheet, /toLocaleLowerCase\("tr-TR"\)/);
assert.match(sheet, /<ExamInfo exams=\{student\.examsTaken\}/);
// Tam eylem sözleşmesi API katmanında; pencere ekle/yeniden adlandır/aç/kapat kullanır.
assert.match(api, /action: "create" \| "rename" \| "activate" \| "deactivate" \| "reorder"/);
assert.match(manager, /manageStudentExamOption\(\{ action,/);
assert.match(api, /from\("student_exam_options"\)/);
assert.match(api, /rpc\("admin_manage_student_exam_option"/);
assert.match(migration, /create table if not exists public\.student_exam_options/);
assert.match(migration, /lower\(btrim\(label\)\)/);
assert.doesNotMatch(migration, /update public\.student_profiles|delete from|drop table|drop column/);

console.log("student exam option invariants: PASS");
