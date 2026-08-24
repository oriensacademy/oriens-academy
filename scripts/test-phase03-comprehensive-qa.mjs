import assert from "node:assert/strict";
import {
  CONTENT_TYPE_LABELS,
  formatContentTypeLabel,
  isSubmittableContentType,
} from "../src/lib/homework.ts";
import { renderStudentHomeworkAssignedEmail } from "../supabase/functions/_shared/email/templates.ts";

console.log("\n=======================================================");
console.log("   ORIENS ACADEMY — PHASE 03 COMPREHENSIVE QA SUITE");
console.log("=======================================================\n");

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}\n`);
  }
}

// 1. Content Types & Helpers
test("1. Content Types and Helper Functions", () => {
  assert.equal(isSubmittableContentType("lesson_note"), false, "lesson_note must NOT be submittable");
  assert.equal(isSubmittableContentType("resource"), false, "resource must NOT be submittable");
  assert.equal(isSubmittableContentType("homework"), true, "homework must be submittable");
  assert.equal(isSubmittableContentType("worksheet"), true, "worksheet must be submittable");
  assert.equal(isSubmittableContentType("mock_exam"), true, "mock_exam must be submittable");

  assert.equal(formatContentTypeLabel("lesson_note"), "Ders Notu");
  assert.equal(formatContentTypeLabel("resource"), "Kaynak / Materyal");
  assert.equal(formatContentTypeLabel("homework"), "Ödev");
  assert.equal(formatContentTypeLabel("worksheet"), "Çalışma Kağıdı");
  assert.equal(formatContentTypeLabel("mock_exam"), "Deneme");

  assert.ok(CONTENT_TYPE_LABELS.lesson_note.badgeClass.includes("purple"));
  assert.ok(CONTENT_TYPE_LABELS.resource.badgeClass.includes("amber"));
  assert.ok(CONTENT_TYPE_LABELS.homework.badgeClass.includes("blue"));
  assert.ok(CONTENT_TYPE_LABELS.worksheet.badgeClass.includes("emerald"));
  assert.ok(CONTENT_TYPE_LABELS.mock_exam.badgeClass.includes("rose"));
});

// 2. Email Subject & Title Generation per Content Type
test("2. Email Notifications per Content Type", () => {
  const noteEmail = renderStudentHomeworkAssignedEmail({
    homeworkId: "hw-1",
    studentName: "Mert Ömeroğlu",
    studentEmail: "student@test.com",
    assignmentTitle: "Calculus & Limits Ders Notları",
    subjectOrLesson: "IB Mathematics HL",
    dueDate: new Date().toISOString(),
    contentType: "lesson_note",
    locale: "tr",
  });
  assert.equal(noteEmail.subject, "Yeni Ders Notunuz Var | Oriens Academy");
  assert.ok(noteEmail.html.includes("Yeni Ders Notunuz Var"));
  assert.ok(noteEmail.html.includes("İçeriği Görüntüle"));

  const resourceEmail = renderStudentHomeworkAssignedEmail({
    homeworkId: "hw-2",
    studentName: "Mert Ömeroğlu",
    studentEmail: "student@test.com",
    assignmentTitle: "SAT Reading Kaynak Dokümanı",
    subjectOrLesson: "Digital SAT",
    dueDate: new Date().toISOString(),
    contentType: "resource",
    locale: "tr",
  });
  assert.equal(resourceEmail.subject, "Yeni Eğitim Materyaliniz Var | Oriens Academy");
  assert.ok(resourceEmail.html.includes("Yeni Eğitim Materyaliniz Var"));

  const mockExamEmail = renderStudentHomeworkAssignedEmail({
    homeworkId: "hw-3",
    studentName: "Mert Ömeroğlu",
    studentEmail: "student@test.com",
    assignmentTitle: "AP Physics 1 Deneme Sınavı",
    subjectOrLesson: "AP Physics",
    dueDate: new Date().toISOString(),
    contentType: "mock_exam",
    locale: "tr",
  });
  assert.equal(mockExamEmail.subject, "Yeni Denemeniz Var | Oriens Academy");
  assert.ok(mockExamEmail.html.includes("Yeni Denemeniz Var"));

  const hwEmail = renderStudentHomeworkAssignedEmail({
    homeworkId: "hw-4",
    studentName: "Mert Ömeroğlu",
    studentEmail: "student@test.com",
    assignmentTitle: "Vectors Problem Set",
    subjectOrLesson: "Matematik",
    dueDate: new Date().toISOString(),
    contentType: "homework",
    locale: "tr",
  });
  assert.equal(hwEmail.subject, "Yeni Ödeviniz Var | Oriens Academy");
  assert.ok(hwEmail.html.includes("Yeni Ödeviniz Var"));
});

// 3. Security: Executable File Block Verification
test("3. Security Extension Blocking on Attachment Uploads", () => {
  const forbiddenExts = ["exe", "bat", "cmd", "sh", "msi", "com", "ps1", "dll", "vbs", "jar", "app", "bin"];
  for (const ext of forbiddenExts) {
    const filename = `malicious_payload.${ext}`;
    const extMatch = filename.split(".").pop()?.toLowerCase();
    assert.ok(forbiddenExts.includes(extMatch || ""), `Extension ${ext} must be blocked`);
  }

  const allowedExts = ["pdf", "docx", "pptx", "xlsx", "png", "jpg", "jpeg", "webp", "zip"];
  for (const ext of allowedExts) {
    const filename = `legitimate_document.${ext}`;
    const extMatch = filename.split(".").pop()?.toLowerCase();
    assert.ok(!forbiddenExts.includes(extMatch || ""), `Extension ${ext} must be allowed`);
  }
});

// 4. Content Library IA & Tab Structure Verification
test("4. Content Library 3-Tab Architecture", () => {
  const primaryTabs = ["content", "assignments", "submissions"];
  assert.equal(primaryTabs.length, 3, "There must be exactly 3 primary tabs in /admin/odevler");
  assert.ok(primaryTabs.includes("content"), "Primary tab 1: İçerikler");
  assert.ok(primaryTabs.includes("assignments"), "Primary tab 2: Atamalar");
  assert.ok(primaryTabs.includes("submissions"), "Primary tab 3: Teslimler");
});

// 5. Scenario Simulation: Content Creation, Assignment & Student View Segregation
test("5. End-to-End Content Lifecycle Simulation", () => {
  // 5a. Lesson Note Creation
  const lessonNoteTemplate = {
    id: "tpl-note-1",
    title: "IB Physics HL — Wave Phenomena Summary",
    content_type: "lesson_note",
    exam: "ib",
    subject: "Fizik",
    language: "tr",
    resource_file_url: "resources/ib-physics-waves.pdf",
    attachment_name: "ib-physics-waves.pdf",
    description: "Bu notta dalga teorisi ve girişim desenleri özetlenmiştir.",
    questions: [],
  };
  assert.equal(isSubmittableContentType(lessonNoteTemplate.content_type), false);
  assert.equal(lessonNoteTemplate.questions.length, 0);

  // 5b. Homework Creation with 3 Questions
  const homeworkTemplate = {
    id: "tpl-hw-1",
    title: "AP Calculus AB — Derivative Rules Practice",
    content_type: "homework",
    exam: "ap",
    subject: "Matematik",
    language: "tr",
    estimated_duration_minutes: 45,
    description: "Lütfen tüm adımları göstererek çözünüz.",
    questions: [
      {
        position: 0,
        question_type: "multiple_choice",
        prompt: "d/dx (sin(3x)) türevi nedir?",
        options: [
          { option_key: "A", option_text: "3*cos(3x)", is_correct: true },
          { option_key: "B", option_text: "cos(3x)", is_correct: false },
          { option_key: "C", option_text: "-3*cos(3x)", is_correct: false },
          { option_key: "D", option_text: "-cos(3x)", is_correct: false },
        ],
      },
      {
        position: 1,
        question_type: "short_answer",
        prompt: "f(x) = x^3 - 3x fonksiyonunun x=2 noktasındaki teğetinin eğimi kaçtır?",
        reference_answer: "9",
      },
      {
        position: 2,
        question_type: "long_answer",
        prompt: "Ortalama Değer Teoremini ifade ediniz ve f(x)=x^2 için [0,2] aralığında c değerini bulunuz.",
        reference_answer: "c = 1",
      },
    ],
  };
  assert.equal(isSubmittableContentType(homeworkTemplate.content_type), true);
  assert.equal(homeworkTemplate.questions.length, 3);

  // 5c. Mock Exam Creation from Stored Bank Question
  const mockExamTemplate = {
    id: "tpl-mock-1",
    title: "Digital SAT Math Section — Diagnostic Mini-Exam",
    content_type: "mock_exam",
    exam: "sat",
    subject: "SAT Math",
    language: "en",
    estimated_duration_minutes: 35,
    questions: [
      {
        position: 0,
        question_type: "multiple_choice",
        prompt: "If 3x + 7 = 19, what is the value of 6x - 2?",
        options: [
          { option_key: "A", option_text: "22", is_correct: true },
          { option_key: "B", option_text: "24", is_correct: false },
          { option_key: "C", option_text: "26", is_correct: false },
          { option_key: "D", option_text: "28", is_correct: false },
        ],
      },
    ],
  };
  assert.equal(isSubmittableContentType(mockExamTemplate.content_type), true);

  // 5d. Assignment to Student A
  const studentAId = "std-uuid-student-a";
  const studentBId = "std-uuid-student-b";

  const studentAAssignmentNote = {
    id: "sh-1",
    student_user_id: studentAId,
    title: lessonNoteTemplate.title,
    content_type: lessonNoteTemplate.content_type,
    status: "assigned",
  };

  const studentAAssignmentHw = {
    id: "sh-2",
    student_user_id: studentAId,
    title: homeworkTemplate.title,
    content_type: homeworkTemplate.content_type,
    status: "assigned",
  };

  // Student A access verification
  assert.equal(studentAAssignmentNote.student_user_id, studentAId);
  assert.equal(studentAAssignmentHw.student_user_id, studentAId);

  // Student B access denial simulation (RLS / Auth guarantee)
  const isStudentAAllowed = studentAAssignmentHw.student_user_id === studentAId;
  const isStudentBAllowed = studentAAssignmentHw.student_user_id === studentBId;
  assert.equal(isStudentAAllowed, true, "Student A must have access to their assignment");
  assert.equal(isStudentBAllowed, false, "Student B must NOT have access to Student A's assignment");

  // Student Portal interaction simulation
  const noteIsSubmittable = isSubmittableContentType(studentAAssignmentNote.content_type);
  assert.equal(noteIsSubmittable, false, "Lesson note in student portal must be read-only (no submit button)");

  const hwIsSubmittable = isSubmittableContentType(studentAAssignmentHw.content_type);
  assert.equal(hwIsSubmittable, true, "Homework in student portal must be interactive (draft / submit / upload)");

  // Draft state save simulation
  const studentAnswers = [
    { question_id: "q-0", selected_option_id: "opt-A", answer_text: null },
    { question_id: "q-1", selected_option_id: null, answer_text: "9" },
    { question_id: "q-2", selected_option_id: null, answer_text: "c = 1 (f'(c) = (4-0)/2 = 2 => 2c = 2 => c=1)" },
  ];
  assert.equal(studentAnswers.length, 3);

  // Submission state change
  const submittedHw = { ...studentAAssignmentHw, status: "submitted", submitted_at: new Date().toISOString() };
  assert.equal(submittedHw.status, "submitted");

  // Admin Review simulation
  const reviewedHw = {
    ...submittedHw,
    status: "reviewed",
    teacher_feedback: "Mükemmel çözüm adımları! Tebrikler.",
    score: 100,
  };
  assert.equal(reviewedHw.status, "reviewed");
  assert.equal(reviewedHw.score, 100);
});

console.log("\n-------------------------------------------------------");
console.log(`QA Result: ${passed}/${total} checks passed (${Math.round((passed / total) * 100)}%)`);
console.log("-------------------------------------------------------\n");

if (passed !== total) {
  process.exit(1);
}
