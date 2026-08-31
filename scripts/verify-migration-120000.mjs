import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("=== VERIFYING INVARIANTS AFTER MIGRATION 120000 ===");
  
  // 1. EXAMS
  const { data: exams } = await supabase
    .from("exams")
    .select("code, display_order, supported_public, active")
    .order("display_order", { ascending: true });

  const supportedPublic = exams.filter(e => e.supported_public);
  console.log(`- Supported public exams count: ${supportedPublic.length} (expected 15)`);
  const expectedOrder = ["IB", "AP", "IGCSE", "A-Level", "SAT", "ACT", "ESAT", "TMUA", "TARA", "UCAT", "IMAT", "MCAT", "GRE", "GMAT", "OMPT"];
  const actualOrder = supportedPublic.map(e => e.code);
  console.log(`- Supported public order: ${actualOrder.join(", ")}`);
  console.log(`- Order matches expected: ${JSON.stringify(actualOrder) === JSON.stringify(expectedOrder)}`);

  const legacyExams = exams.filter(e => ["LNAT", "LSAT", "GAMSAT"].includes(e.code));
  console.log(`- Legacy exams preserved: ${legacyExams.map(e => `${e.code}: active=${e.active}, supported_public=${e.supported_public}, order=${e.display_order}`).join("; ")}`);

  // 2. PRACTICE QUESTIONS
  const { count: activeQuestions } = await supabase
    .from("exam_practice_questions")
    .select("*", { count: "exact", head: true })
    .eq("active", true);
  console.log(`- Total active practice questions: ${activeQuestions} (expected 90)`);

  const { data: qData } = await supabase
    .from("exam_practice_questions")
    .select("exam_id, active, exams!inner(code, supported_public)")
    .eq("active", true);

  const countsByExam = {};
  for (const q of qData) {
    const code = q.exams.code;
    countsByExam[code] = (countsByExam[code] || 0) + 1;
  }
  console.log(`- Active questions per exam: ${JSON.stringify(countsByExam)}`);
  const all6 = expectedOrder.every(code => countsByExam[code] === 6);
  console.log(`- Exactly 6 per retained exam: ${all6}`);

  // 3. ATTEMPTS
  const { count: totalAttempts } = await supabase.from("student_exam_attempts").select("*", { count: "exact", head: true });
  console.log(`- Total attempts preserved: ${totalAttempts}`);

  // 4. TESTIMONIALS
  const { data: testimonials } = await supabase.from("testimonials").select("*");
  console.log(`- Total testimonials preserved: ${testimonials.length} (expected 118)`);
  const featured = testimonials.filter(t => t.featured);
  console.log(`- Featured testimonials count: ${featured.length} (expected 8)`);

  const doguhanFeatured = testimonials.filter(t => (t.student_name && /do[gğ]uhan/i.test(t.student_name)) && t.featured);
  console.log(`- Doğuhan currently featured matches: ${doguhanFeatured.length} (expected 0)`);

  // 5. EGYPT
  const { data: egyCountry } = await supabase.from("countries").select("*").eq("iso2", "EG");
  const { count: egyUnis } = await supabase.from("universities").select("*", { count: "exact", head: true }).eq("country_id", egyCountry[0].id).eq("active", true);
  console.log(`- Egypt preserved: ${egyCountry ? "YES" : "NO"}, Active Unis: ${egyUnis} (expected 123)`);
}

main().catch(console.error);
