import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const split = line.indexOf("=");
      return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing Supabase service credentials in .env.local");

const questions = JSON.parse(fs.readFileSync(path.join(root, "src/data/exam-tests-source.json"), "utf8"));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: exams, error: examError } = await supabase.from("exams").select("id,code");
if (examError) throw examError;
const examIds = new Map(exams.map((exam) => [exam.code.toLowerCase(), exam.id]));

const rows = Object.entries(questions).flatMap(([keyName, items]) => {
  const examId = examIds.get(keyName);
  if (!examId) throw new Error(`No canonical exam for question key ${keyName}`);
  return items.map((item, index) => ({
    id: `${keyName}-q-${index + 1}`,
    exam_id: examId,
    topic: item.topic,
    question: item.q,
    options: ["a", "b", "c", "d"].map((id, optionIndex) => ({ id, label: item.answers[optionIndex] })),
    correct_answer: item.correct,
    explanation: item.exp,
    solution: item.exp,
    difficulty: index < 2 ? "foundation" : index < 5 ? "intermediate" : "advanced",
    source_type: "ORIENS_ORIGINAL_PRACTICE",
    active: true,
    display_order: index + 1,
    syllabus_version: "reviewed-2026-08-30",
    reviewed_at: "2026-08-30T00:00:00Z",
  }));
});
if (rows.length !== 90) throw new Error(`Expected 90 public questions, found ${rows.length}`);
const { error } = await supabase.from("exam_practice_questions").upsert(rows, { onConflict: "id" });
if (error) throw error;
console.log(JSON.stringify({ synced: rows.length, exams: examIds.size }));
