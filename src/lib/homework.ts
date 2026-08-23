import { getSupabaseClient } from "@/lib/supabase/client";

export type HomeworkQuestionType = "multiple_choice" | "short_answer" | "long_answer";
export type HomeworkStatus = "assigned" | "in_progress" | "submitted" | "reviewed" | "overdue";
export interface HomeworkOption { id?: string; option_key: "A" | "B" | "C" | "D"; option_text: string; is_correct?: boolean }
export interface HomeworkQuestion { id?: string; position: number; question_type: HomeworkQuestionType; prompt: string; reference_answer?: string | null; explanation?: string | null; options: HomeworkOption[] }
export interface HomeworkAnswer { question_id: string; answer_text: string | null; selected_option_id: string | null }
export interface HomeworkAttachment { id: string; assignment_id: string | null; student_homework_id: string | null; attachment_kind: "resource" | "submission"; storage_path: string; file_name: string; file_size: number; mime_type: string; created_at: string }
export interface HomeworkDetail {
  homework: Record<string, unknown> & { id: string; status: HomeworkStatus; teacher_feedback?: string | null; submitted_at?: string | null };
  assignment: { id: string; title: string; description: string; due_date: string | null; external_link: string | null };
  questions: HomeworkQuestion[];
  answers: Array<HomeworkAnswer & { id?: string }>;
  attachments: HomeworkAttachment[];
}

const rpc = async (name: string, args: Record<string, unknown>) => {
  const client = getSupabaseClient();
  return (client.rpc as unknown as (fn: string, values: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(name, args);
};

export async function createInteractiveHomework(input: { title: string; description: string; studentIds: string[]; lessonId?: string | null; dueDate?: string | null; externalLink?: string | null; instructorNote?: string | null; questions: HomeworkQuestion[] }) {
  const { data, error } = await rpc("admin_create_interactive_homework", { p_assignment: { title: input.title, description: input.description, lesson_id: input.lessonId || null, due_date: input.dueDate || null, external_link: input.externalLink || null, instructor_note: input.instructorNote || null }, p_student_ids: input.studentIds, p_questions: input.questions });
  const result = data as { success?: boolean; assignment_id?: string; homework_ids?: string[]; error_code?: string } | null;
  return { data: result, error: error?.message || (!result?.success ? result?.error_code || "Ödev oluşturulamadı." : null) };
}

export async function getStudentHomeworkDetail(homeworkId: string) {
  const { data, error } = await rpc("get_student_homework_detail", { p_homework_id: homeworkId });
  return { data: data as HomeworkDetail | null, error: error?.message || null };
}

export async function saveHomeworkDraft(homeworkId: string, answers: HomeworkAnswer[]) {
  const { data, error } = await rpc("save_homework_draft", { p_homework_id: homeworkId, p_answers: answers });
  const result = data as { success?: boolean; error_code?: string; saved_at?: string } | null;
  return { data: result, error: error?.message || (!result?.success ? result?.error_code || "Taslak kaydedilemedi." : null) };
}

export async function submitInteractiveHomework(homeworkId: string, answers: HomeworkAnswer[]) {
  const { data, error } = await rpc("submit_interactive_homework", { p_homework_id: homeworkId, p_answers: answers });
  const result = data as { success?: boolean; error_code?: string } | null;
  return { data: result, error: error?.message || (!result?.success ? result?.error_code || "Ödev teslim edilemedi." : null) };
}

export async function reviewInteractiveHomework(homeworkId: string, feedback: string, reopen = false) {
  const { data, error } = await rpc("admin_review_interactive_homework", { p_homework_id: homeworkId, p_feedback: feedback, p_reopen: reopen });
  const result = data as { success?: boolean; error_code?: string } | null;
  return { data: result, error: error?.message || (!result?.success ? result?.error_code || "Değerlendirme kaydedilemedi." : null) };
}

export async function sendHomeworkEmail(input: { action: "assigned"; assignmentId: string } | { action: "reviewed"; homeworkId: string }) {
  const { data, error } = await getSupabaseClient().functions.invoke("send-homework-email", { body: input });
  return { data, error: error?.message || null };
}

export async function getAdminHomeworkDetail(homeworkId: string): Promise<{ data: HomeworkDetail | null; error: string | null }> {
  const client = getSupabaseClient();
  const { data: homework, error } = await client.from("student_homework").select("*").eq("id", homeworkId).single();
  if (error || !homework) return { data: null, error: error?.message || "Ödev bulunamadı." };
  const raw = homework as unknown as { assignment_id: string };
  const [assignment, questions, answers, attachments] = await Promise.all([
    client.from("homework_assignments" as never).select("*").eq("id", raw.assignment_id).single(),
    client.from("homework_questions" as never).select("*,homework_question_options(*)").eq("assignment_id", raw.assignment_id).order("position"),
    client.from("homework_student_answers" as never).select("*").eq("student_homework_id", homeworkId),
    client.from("homework_attachments" as never).select("*").or(`assignment_id.eq.${raw.assignment_id},student_homework_id.eq.${homeworkId}`),
  ]);
  const questionRows = (questions.data || []) as unknown as Array<Record<string, unknown>>;
  return { data: { homework: homework as unknown as HomeworkDetail["homework"], assignment: assignment.data as unknown as HomeworkDetail["assignment"], questions: questionRows.map((q) => ({ ...q, options: q.homework_question_options || [] })) as unknown as HomeworkQuestion[], answers: (answers.data || []) as unknown as HomeworkDetail["answers"], attachments: (attachments.data || []) as unknown as HomeworkAttachment[] }, error: assignment.error?.message || questions.error?.message || answers.error?.message || attachments.error?.message || null };
}

export async function uploadHomeworkAttachment(input: { file: File; assignmentId?: string; studentHomeworkId?: string; studentId?: string; kind: "resource" | "submission" }) {
  const client = getSupabaseClient();
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = input.kind === "resource" ? `resources/${input.assignmentId}/${crypto.randomUUID()}-${safeName}` : `submissions/${input.studentId}/${input.studentHomeworkId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage.from("homework-attachments").upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) return { data: null, error: uploadError.message };
  const insert = await client.from("homework_attachments" as never).insert({ assignment_id: input.assignmentId || null, student_homework_id: input.studentHomeworkId || null, attachment_kind: input.kind, storage_path: path, file_name: input.file.name, file_size: input.file.size, mime_type: input.file.type, uploaded_by: input.studentId || (await client.auth.getUser()).data.user?.id } as never).select().single();
  return { data: insert.data as unknown as HomeworkAttachment | null, error: insert.error?.message || null };
}

export async function openHomeworkAttachment(path: string) {
  const { data, error } = await getSupabaseClient().storage.from("homework-attachments").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { error: error?.message || "Dosya açılamadı." };
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  return { error: null };
}
