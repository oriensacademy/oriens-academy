import { getSupabaseClient } from "@/lib/supabase/client";

export type HomeworkContentType = "homework" | "lesson_note" | "worksheet" | "resource" | "mock_exam";
export type HomeworkQuestionType = "multiple_choice" | "short_answer" | "long_answer";
export type HomeworkStatus = "assigned" | "in_progress" | "submitted" | "reviewed" | "overdue";
export type QuestionLanguage = "en" | "tr";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export const CONTENT_TYPE_LABELS: Record<HomeworkContentType, { tr: string; en: string; badgeClass: string }> = {
  homework: {
    tr: "Ödev",
    en: "Homework",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800",
  },
  lesson_note: {
    tr: "Ders Notu",
    en: "Lesson Note",
    badgeClass: "border-purple-200 bg-purple-50 text-purple-800",
  },
  worksheet: {
    tr: "Çalışma Kağıdı",
    en: "Worksheet",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  resource: {
    tr: "Kaynak / Materyal",
    en: "Resource / Material",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  mock_exam: {
    tr: "Deneme",
    en: "Mock Exam",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
  },
};

export function formatContentTypeLabel(type?: HomeworkContentType | string | null, locale: "tr" | "en" = "tr") {
  const normalized = (type as HomeworkContentType) || "homework";
  const entry = CONTENT_TYPE_LABELS[normalized];
  return entry ? (locale === "tr" ? entry.tr : entry.en) : (locale === "tr" ? "İçerik" : "Content");
}

export function isSubmittableContentType(type?: HomeworkContentType | string | null) {
  const normalized = (type as HomeworkContentType) || "homework";
  return normalized === "homework" || normalized === "worksheet" || normalized === "mock_exam";
}

export interface HomeworkOption {
  id?: string;
  option_key: "A" | "B" | "C" | "D";
  option_text: string;
  is_correct?: boolean;
}

export interface HomeworkQuestion {
  id?: string;
  question_bank_id?: string | null;
  position: number;
  question_type: HomeworkQuestionType;
  prompt: string;
  reference_answer?: string | null;
  explanation?: string | null;
  options: HomeworkOption[];
}

export interface QuestionBankItem {
  id: string;
  code: string | null;
  exam: string;
  topic: string;
  difficulty: QuestionDifficulty | null;
  language: QuestionLanguage;
  question_type: HomeworkQuestionType;
  prompt: string;
  options: HomeworkOption[];
  reference_answer: string | null;
  explanation: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface HomeworkTemplate {
  id: string;
  title: string;
  description: string;
  content_type?: HomeworkContentType;
  language?: QuestionLanguage;
  subject: string | null;
  exam: string | null;
  exam_code?: string | null;
  resource_file_url?: string | null;
  attachment_name?: string | null;
  estimated_duration_minutes: number | null;
  external_link: string | null;
  instructor_note: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  questions?: HomeworkQuestion[];
}

export interface MockExam {
  id: string;
  title: string;
  exam: string;
  description: string;
  time_limit_minutes: number | null;
  topic_mix: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  questions?: HomeworkQuestion[];
}

export interface HomeworkAnswer {
  question_id: string;
  answer_text: string | null;
  selected_option_id: string | null;
}

export interface HomeworkAttachment {
  id: string;
  assignment_id: string | null;
  student_homework_id: string | null;
  attachment_kind: "resource" | "submission";
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface HomeworkDetail {
  homework: Record<string, unknown> & {
    id: string;
    status: HomeworkStatus;
    content_type?: HomeworkContentType;
    title?: string;
    description?: string;
    teacher_feedback?: string | null;
    submitted_at?: string | null;
    draft_saved_at?: string | null;
    student_user_id?: string;
    student_name?: string;
    due_date?: string | null;
  };
  assignment: {
    id: string;
    title: string;
    description: string;
    content_type?: HomeworkContentType;
    language?: QuestionLanguage;
    exam_code?: string | null;
    resource_file_url?: string | null;
    attachment_name?: string | null;
    due_date: string | null;
    external_link: string | null;
    instructor_note?: string | null;
  };
  questions: HomeworkQuestion[];
  answers: Array<HomeworkAnswer & { id?: string }>;
  attachments: HomeworkAttachment[];
}

const rpc = async (name: string, args: Record<string, unknown>) => {
  const client = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).rpc(name, args);
};

// ============================================================================
// QUESTION BANK (SORU BANKASI)
// ============================================================================

export async function getQuestionBankItems(filter?: {
  exam?: string;
  topic?: string;
  question_type?: string;
  language?: string;
  query?: string;
}): Promise<{ data: QuestionBankItem[]; error: string | null }> {
  const client = getSupabaseClient();
  let q = client
    .from("question_bank" as never)
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (filter?.exam) q = q.eq("exam", filter.exam);
  if (filter?.topic) q = q.ilike("topic", `%${filter.topic}%`);
  if (filter?.question_type) q = q.eq("question_type", filter.question_type);
  if (filter?.language) q = q.eq("language", filter.language);
  if (filter?.query) {
    q = q.or(`prompt.ilike.%${filter.query}%,code.ilike.%${filter.query}%,topic.ilike.%${filter.query}%`);
  }

  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as unknown as QuestionBankItem[], error: null };
}

export async function saveQuestionBankItem(
  item: Partial<QuestionBankItem> & { prompt: string; exam: string; topic: string; question_type: HomeworkQuestionType }
): Promise<{ data: QuestionBankItem | null; error: string | null }> {
  const client = getSupabaseClient();
  const payload = {
    code: item.code?.trim() || null,
    exam: item.exam.trim(),
    topic: item.topic.trim(),
    difficulty: item.difficulty || null,
    language: item.language || "en",
    question_type: item.question_type,
    prompt: item.prompt.trim(),
    options: item.options || [],
    reference_answer: item.reference_answer?.trim() || null,
    explanation: item.explanation?.trim() || null,
    status: item.status || "active",
    updated_at: new Date().toISOString(),
  };

  if (item.id) {
    const { data, error } = await client
      .from("question_bank" as never)
      .update(payload as never)
      .eq("id", item.id)
      .select()
      .single();
    return { data: data as unknown as QuestionBankItem | null, error: error?.message || null };
  } else {
    const { data, error } = await client
      .from("question_bank" as never)
      .insert(payload as never)
      .select()
      .single();
    return { data: data as unknown as QuestionBankItem | null, error: error?.message || null };
  }
}

export async function archiveQuestionBankItem(id: string): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("question_bank" as never)
    .update({ status: "archived", updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  return { error: error?.message || null };
}

// ============================================================================
// HOMEWORK TEMPLATES (ÖDEV ŞABLONLARI)
// ============================================================================

export async function getHomeworkTemplates(): Promise<{ data: HomeworkTemplate[]; error: string | null }> {
  const client = getSupabaseClient();
  const { data: templates, error: tErr } = await client
    .from("homework_templates" as never)
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (tErr) return { data: [], error: tErr.message };

  // Fetch questions for each template
  const { data: templateQuestions, error: qErr } = await client
    .from("homework_template_questions" as never)
    .select("*")
    .order("position", { ascending: true });

  const rawTemplates = (templates || []) as unknown as Array<Record<string, unknown>>;
  const rawQuestions = (templateQuestions || []) as unknown as Array<Record<string, unknown>>;

  if (qErr) {
    return { data: rawTemplates as unknown as HomeworkTemplate[], error: null };
  }

  const grouped = rawTemplates.map((t) => {
    const questions = rawQuestions
      .filter((q) => q.template_id === t.id)
      .map((q) => ({
        id: q.id as string,
        question_bank_id: (q.question_bank_id as string) || null,
        position: (q.position as number) || 0,
        question_type: q.question_type as HomeworkQuestionType,
        prompt: (q.prompt as string) || "",
        reference_answer: (q.reference_answer as string) || null,
        explanation: (q.explanation as string) || null,
        options: (q.options as HomeworkOption[]) || [],
      }));
    return { ...t, questions } as unknown as HomeworkTemplate;
  });

  return { data: grouped, error: null };
}

export async function saveHomeworkTemplate(input: {
  id?: string;
  title: string;
  description: string;
  content_type?: HomeworkContentType;
  language?: QuestionLanguage;
  subject?: string | null;
  exam?: string | null;
  exam_code?: string | null;
  resource_file_url?: string | null;
  attachment_name?: string | null;
  estimated_duration_minutes?: number | null;
  external_link?: string | null;
  instructor_note?: string | null;
  questions?: HomeworkQuestion[];
}): Promise<{ data: HomeworkTemplate | null; error: string | null }> {
  const client = getSupabaseClient();
  const templatePayload = {
    title: input.title.trim(),
    description: input.description.trim(),
    content_type: input.content_type || "homework",
    language: input.language || "tr",
    subject: input.subject?.trim() || null,
    exam: input.exam?.trim() || input.exam_code?.trim() || null,
    exam_code: input.exam_code?.trim() || input.exam?.trim() || null,
    resource_file_url: input.resource_file_url?.trim() || null,
    attachment_name: input.attachment_name?.trim() || null,
    estimated_duration_minutes: input.estimated_duration_minutes || null,
    external_link: input.external_link?.trim() || null,
    instructor_note: input.instructor_note?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let templateId = input.id;
  if (templateId) {
    const { error } = await client
      .from("homework_templates" as never)
      .update(templatePayload as never)
      .eq("id", templateId);
    if (error) return { data: null, error: error.message };

    // Delete existing template questions and recreate
    await client.from("homework_template_questions" as never).delete().eq("template_id", templateId);
  } else {
    const { data, error } = await client
      .from("homework_templates" as never)
      .insert(templatePayload as never)
      .select()
      .single();
    if (error || !data) return { data: null, error: error?.message || "İçerik oluşturulamadı." };
    templateId = (data as unknown as { id: string }).id;
  }

  // Insert template questions
  if (input.questions && input.questions.length > 0) {
    const questionsPayload = input.questions.map((q, idx) => ({
      template_id: templateId,
      question_bank_id: q.question_bank_id || null,
      position: idx,
      question_type: q.question_type,
      prompt: q.prompt.trim(),
      options: q.options || [],
      reference_answer: q.reference_answer?.trim() || null,
      explanation: q.explanation?.trim() || null,
    }));
    await client.from("homework_template_questions" as never).insert(questionsPayload as never);
  }

  return {
    data: {
      id: templateId,
      ...templatePayload,
      status: "active",
      created_at: "",
      questions: input.questions || [],
    } as unknown as HomeworkTemplate,
    error: null,
  };
}

export async function duplicateHomeworkTemplate(id: string): Promise<{ data: HomeworkTemplate | null; error: string | null }> {
  const client = getSupabaseClient();
  const { data: original, error } = await client.from("homework_templates" as never).select("*").eq("id", id).single();
  if (error || !original) return { data: null, error: error?.message || "İçerik bulunamadı." };

  const rawOriginal = original as unknown as Record<string, unknown>;
  const { data: questions } = await client.from("homework_template_questions" as never).select("*").eq("template_id", id).order("position");
  const rawQuestions = (questions || []) as unknown as Array<Record<string, unknown>>;

  return saveHomeworkTemplate({
    title: `${rawOriginal.title} (Kopya)`,
    description: (rawOriginal.description as string) || "",
    content_type: (rawOriginal.content_type as HomeworkContentType) || "homework",
    language: (rawOriginal.language as QuestionLanguage) || "tr",
    subject: (rawOriginal.subject as string) || null,
    exam: (rawOriginal.exam as string) || (rawOriginal.exam_code as string) || null,
    exam_code: (rawOriginal.exam_code as string) || (rawOriginal.exam as string) || null,
    resource_file_url: (rawOriginal.resource_file_url as string) || null,
    attachment_name: (rawOriginal.attachment_name as string) || null,
    estimated_duration_minutes: (rawOriginal.estimated_duration_minutes as number) || null,
    external_link: (rawOriginal.external_link as string) || null,
    instructor_note: (rawOriginal.instructor_note as string) || null,
    questions: rawQuestions.map((q) => ({
      position: (q.position as number) || 0,
      question_bank_id: (q.question_bank_id as string) || null,
      question_type: q.question_type as HomeworkQuestionType,
      prompt: (q.prompt as string) || "",
      reference_answer: (q.reference_answer as string) || null,
      explanation: (q.explanation as string) || null,
      options: (q.options as HomeworkOption[]) || [],
    })),
  });
}

export async function archiveHomeworkTemplate(id: string): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("homework_templates" as never)
    .update({ status: "archived", updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  return { error: error?.message || null };
}

// ============================================================================
// MOCK EXAMS (DENEMELER)
// ============================================================================

export async function getMockExams(): Promise<{ data: MockExam[]; error: string | null }> {
  const client = getSupabaseClient();
  const { data: mocks, error: mErr } = await client
    .from("mock_exams" as never)
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (mErr) return { data: [], error: mErr.message };

  const { data: questions } = await client
    .from("mock_exam_questions" as never)
    .select("*")
    .order("position", { ascending: true });

  const rawMocks = (mocks || []) as unknown as Array<Record<string, unknown>>;
  const rawQuestions = (questions || []) as unknown as Array<Record<string, unknown>>;

  const grouped = rawMocks.map((m) => {
    const qList = rawQuestions
      .filter((q) => q.mock_exam_id === m.id)
      .map((q) => ({
        id: q.id as string,
        position: (q.position as number) || 0,
        question_type: q.question_type as HomeworkQuestionType,
        prompt: (q.prompt as string) || "",
        reference_answer: (q.reference_answer as string) || null,
        explanation: (q.explanation as string) || null,
        options: (q.options as HomeworkOption[]) || [],
      }));
    return { ...m, questions: qList } as unknown as MockExam;
  });

  return { data: grouped, error: null };
}

export async function saveMockExam(input: {
  id?: string;
  title: string;
  exam: string;
  description: string;
  time_limit_minutes?: number | null;
  topic_mix?: string | null;
  questions: HomeworkQuestion[];
}): Promise<{ data: MockExam | null; error: string | null }> {
  const client = getSupabaseClient();
  const payload = {
    title: input.title.trim(),
    exam: input.exam.trim(),
    description: input.description.trim(),
    time_limit_minutes: input.time_limit_minutes || null,
    topic_mix: input.topic_mix?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  let mockId = input.id;
  if (mockId) {
    const { error } = await client.from("mock_exams" as never).update(payload as never).eq("id", mockId);
    if (error) return { data: null, error: error.message };
    await client.from("mock_exam_questions" as never).delete().eq("mock_exam_id", mockId);
  } else {
    const { data, error } = await client.from("mock_exams" as never).insert(payload as never).select().single();
    if (error || !data) return { data: null, error: error?.message || "Deneme oluşturulamadı." };
    mockId = (data as unknown as { id: string }).id;
  }

  if (input.questions && input.questions.length > 0) {
    const questionsPayload = input.questions.map((q, idx) => ({
      mock_exam_id: mockId,
      position: idx,
      question_type: q.question_type,
      prompt: q.prompt.trim(),
      options: q.options || [],
      reference_answer: q.reference_answer?.trim() || null,
      explanation: q.explanation?.trim() || null,
    }));
    await client.from("mock_exam_questions" as never).insert(questionsPayload as never);
  }

  return {
    data: {
      id: mockId,
      ...payload,
      status: "active",
      created_at: "",
      questions: input.questions,
    } as unknown as MockExam,
    error: null,
  };
}

export async function archiveMockExam(id: string): Promise<{ error: string | null }> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("mock_exams" as never)
    .update({ status: "archived", updated_at: new Date().toISOString() } as never)
    .eq("id", id);
  return { error: error?.message || null };
}

// ============================================================================
// ASSIGNMENT FLOW (ŞABLON / DENEME ATAMA)
// ============================================================================

export async function assignTemplateToStudents(input: {
  templateId: string;
  studentIds: string[];
  dueDate?: string | null;
  lessonId?: string | null;
  customTitle?: string | null;
  customInstructions?: string | null;
  sendEmail?: boolean;
}): Promise<{ data: { assignment_id?: string; homework_ids?: string[] } | null; error: string | null }> {
  const { data, error } = await rpc("admin_assign_homework_template", {
    p_template_id: input.templateId,
    p_student_ids: input.studentIds,
    p_due_date: input.dueDate || null,
    p_lesson_id: input.lessonId || null,
    p_custom_title: input.customTitle || null,
    p_custom_instructions: input.customInstructions || null,
  });

  const result = data as { success?: boolean; assignment_id?: string; homework_ids?: string[]; error_code?: string } | null;
  if (error || !result?.success || !result.assignment_id) {
    return { data: null, error: error?.message || result?.error_code || "Ödev atanamadı." };
  }

  if (input.sendEmail && result.assignment_id) {
    void sendHomeworkEmail({ action: "assigned", assignmentId: result.assignment_id });
  }

  return { data: result, error: null };
}

// ============================================================================
// INTERACTIVE HOMEWORK ENGINE (STUDENT & ADMIN)
// ============================================================================

export async function createInteractiveHomework(input: {
  title: string;
  description: string;
  studentIds: string[];
  lessonId?: string | null;
  dueDate?: string | null;
  externalLink?: string | null;
  instructorNote?: string | null;
  questions: HomeworkQuestion[];
}) {
  const { data, error } = await rpc("admin_create_interactive_homework", {
    p_assignment: {
      title: input.title,
      description: input.description,
      lesson_id: input.lessonId || null,
      due_date: input.dueDate || null,
      external_link: input.externalLink || null,
      instructor_note: input.instructorNote || null,
    },
    p_student_ids: input.studentIds,
    p_questions: input.questions,
  });
  const result = data as { success?: boolean; assignment_id?: string; homework_ids?: string[]; error_code?: string } | null;
  return {
    data: result,
    error: error?.message || (!result?.success ? result?.error_code || "Ödev oluşturulamadı." : null),
  };
}

export async function getStudentHomeworkDetail(homeworkId: string) {
  const { data, error } = await rpc("get_student_homework_detail", { p_homework_id: homeworkId });
  return { data: data as HomeworkDetail | null, error: error?.message || null };
}

export async function saveHomeworkDraft(homeworkId: string, answers: HomeworkAnswer[]) {
  const { data, error } = await rpc("save_homework_draft", { p_homework_id: homeworkId, p_answers: answers });
  const result = data as { success?: boolean; error_code?: string; saved_at?: string } | null;
  return {
    data: result,
    error: error?.message || (!result?.success ? result?.error_code || "Taslak kaydedilemedi." : null),
  };
}

export async function submitInteractiveHomework(homeworkId: string, answers: HomeworkAnswer[]) {
  const { data, error } = await rpc("submit_interactive_homework", { p_homework_id: homeworkId, p_answers: answers });
  const result = data as { success?: boolean; error_code?: string } | null;
  return {
    data: result,
    error: error?.message || (!result?.success ? result?.error_code || "Ödev teslim edilemedi." : null),
  };
}

export async function reviewInteractiveHomework(homeworkId: string, feedback: string, reopen = false) {
  const { data, error } = await rpc("admin_review_interactive_homework", {
    p_homework_id: homeworkId,
    p_feedback: feedback,
    p_reopen: reopen,
  });
  const result = data as { success?: boolean; error_code?: string } | null;
  return {
    data: result,
    error: error?.message || (!result?.success ? result?.error_code || "Değerlendirme kaydedilemedi." : null),
  };
}

export async function sendHomeworkEmail(
  _input:
    | { action: "assigned"; assignmentId: string }
    | { action: "reviewed"; homeworkId: string }
    | { action: "revision_requested"; homeworkId: string }
) {
  // Homework notification emails (MAIL-032..036) are permanently removed from system
  return { data: { success: true, disabled: true }, error: null };
}

export async function getAdminHomeworkDetail(homeworkId: string): Promise<{ data: HomeworkDetail | null; error: string | null }> {
  const client = getSupabaseClient();
  const { data: homework, error } = await client.from("student_homework").select("*").eq("id", homeworkId).single();
  if (error || !homework) return { data: null, error: error?.message || "Ödev bulunamadı." };

  const raw = homework as unknown as { assignment_id: string; student_user_id: string };

  const [assignment, questions, answers, attachments, student] = await Promise.all([
    client.from("homework_assignments" as never).select("*").eq("id", raw.assignment_id).single(),
    client.from("homework_questions" as never).select("*,homework_question_options(*)").eq("assignment_id", raw.assignment_id).order("position"),
    client.from("homework_student_answers" as never).select("*").eq("student_homework_id", homeworkId),
    client.from("homework_attachments" as never).select("*").or(`assignment_id.eq.${raw.assignment_id},student_homework_id.eq.${homeworkId}`),
    client.from("student_profiles").select("id, full_name, email").eq("id", raw.student_user_id).single(),
  ]);

  const questionRows = (questions.data || []) as unknown as Array<Record<string, unknown>>;
  const studentData = student.data as { full_name?: string } | null;

  return {
    data: {
      homework: {
        ...(homework as unknown as HomeworkDetail["homework"]),
        student_name: studentData?.full_name || "Öğrenci",
      },
      assignment: assignment.data as unknown as HomeworkDetail["assignment"],
      questions: questionRows.map((q) => ({
        ...q,
        options: (q.homework_question_options as HomeworkOption[]) || [],
      })) as unknown as HomeworkQuestion[],
      answers: (answers.data || []) as unknown as HomeworkDetail["answers"],
      attachments: (attachments.data || []) as unknown as HomeworkAttachment[],
    },
    error:
      assignment.error?.message ||
      questions.error?.message ||
      answers.error?.message ||
      attachments.error?.message ||
      null,
  };
}

const FORBIDDEN_EXTENSIONS = [".exe", ".bat", ".cmd", ".sh", ".msi", ".dll", ".com", ".scr", ".vbs", ".ps1", ".jar", ".bin"];

export async function uploadHomeworkAttachment(input: {
  file: File;
  assignmentId?: string;
  templateId?: string;
  studentHomeworkId?: string;
  studentId?: string;
  kind: "resource" | "submission";
}) {
  const client = getSupabaseClient();
  const ext = "." + (input.file.name.split(".").pop() || "").toLowerCase();
  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return { data: null, error: "Güvenlik nedeniyle bu dosya türü yüklenemez (.exe, .bat, vb.)." };
  }

  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path =
    input.kind === "resource"
      ? `resources/${input.assignmentId || input.templateId || "general"}/${crypto.randomUUID()}-${safeName}`
      : `submissions/${input.studentId}/${input.studentHomeworkId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await client.storage
    .from("homework-attachments")
    .upload(path, input.file, { contentType: input.file.type, upsert: false });

  if (uploadError) return { data: null, error: uploadError.message };

  if (input.assignmentId || input.studentHomeworkId) {
    const insert = await client
      .from("homework_attachments" as never)
      .insert({
        assignment_id: input.assignmentId || null,
        student_homework_id: input.studentHomeworkId || null,
        attachment_kind: input.kind,
        storage_path: path,
        file_name: input.file.name,
        file_size: input.file.size,
        mime_type: input.file.type,
        uploaded_by: input.studentId || (await client.auth.getUser()).data.user?.id,
      } as never)
      .select()
      .single();

    return { data: insert.data as unknown as HomeworkAttachment | null, error: insert.error?.message || null, storagePath: path };
  }

  return {
    data: {
      id: crypto.randomUUID(),
      assignment_id: null,
      student_homework_id: null,
      attachment_kind: input.kind,
      storage_path: path,
      file_name: input.file.name,
      file_size: input.file.size,
      mime_type: input.file.type,
      created_at: new Date().toISOString(),
    } as HomeworkAttachment,
    error: null,
    storagePath: path,
  };
}

export async function openHomeworkAttachment(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    window.open(path, "_blank", "noopener,noreferrer");
    return { error: null };
  }
  const { data, error } = await getSupabaseClient().storage.from("homework-attachments").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { error: error?.message || "Dosya açılamadı." };
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  return { error: null };
}
