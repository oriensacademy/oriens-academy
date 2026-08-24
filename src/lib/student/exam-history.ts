import { getSupabaseClient } from "@/lib/supabase/client";
import type { TestResult } from "@/data/exam-tests";
import type { Locale } from "@/content/dictionaries";

export interface QuestionSnapshot {
  id: string;
  prompt: string;
  topicId: string;
  topicLabel: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  wasCorrect: boolean;
  explanation: string;
}

export interface StudentExamAttempt {
  id: string;
  student_user_id: string;
  exam_code: string;
  locale: "tr" | "en";
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  accuracy: number;
  performance_tier: "strong" | "moderate" | "foundation";
  answers: Record<string, string>;
  topic_analysis: Array<{
    id: string;
    label: string;
    correct: number;
    total: number;
    accuracy: number;
  }>;
  strengths: string[];
  improvement_areas: string[];
  question_snapshots: QuestionSnapshot[];
  recommendation: string | null;
  started_at: string | null;
  completed_at: string;
  created_at: string;
}

export async function saveStudentExamAttempt(input: {
  examCode: string;
  locale: Locale;
  result: TestResult;
  questionSnapshots: QuestionSnapshot[];
  startedAt?: string | null;
}): Promise<{ success: boolean; attemptId?: string; error?: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) {
      return { success: false, error: "UNAUTHENTICATED" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "save_student_exam_attempt",
      {
        p_exam_code: input.examCode,
        p_locale: input.locale,
        p_total_questions: input.result.total,
        p_correct_count: input.result.correct,
        p_incorrect_count: input.result.incorrect,
        p_unanswered_count: input.result.unanswered,
        p_accuracy: input.result.accuracy,
        p_performance_tier: input.result.performanceTier,
        p_answers: (input.result.breakdown || []).reduce<Record<string, string>>((acc, b) => {
          acc[b.id] = b.selectedAnswer || "";
          return acc;
        }, {}),
        p_topic_analysis: input.result.topics,
        p_strengths: input.result.strengths,
        p_improvement_areas: input.result.improvementAreas,
        p_question_snapshots: input.questionSnapshots,
        p_recommendation: input.result.performanceTier || "foundation",
        p_started_at: input.startedAt || null,
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as { success?: boolean; attempt_id?: string; error_code?: string };
    return {
      success: Boolean(res?.success),
      attemptId: res?.attempt_id,
      error: res?.success ? null : (res?.error_code || "SAVE_FAILED"),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "NETWORK_ERROR";
    return { success: false, error: msg };
  }
}

export async function listStudentExamAttempts(userId: string): Promise<{ data: StudentExamAttempt[]; error: string | null }> {
  try {
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from as any)("student_exam_attempts")
      .select("*")
      .eq("student_user_id", userId)
      .order("completed_at", { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data || []) as StudentExamAttempt[], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "NETWORK_ERROR";
    return { data: [], error: msg };
  }
}

export async function claimAnonymousExamResult(claimToken: string): Promise<{ success: boolean; attemptId?: string; error?: string | null }> {
  try {
    const supabase = getSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
      "claim_anonymous_exam_result",
      {
        p_claim_token: claimToken,
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    const res = data as { success?: boolean; attempt_id?: string; error_code?: string };
    return {
      success: Boolean(res?.success),
      attemptId: res?.attempt_id,
      error: res?.success ? null : (res?.error_code || "CLAIM_FAILED"),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "NETWORK_ERROR";
    return { success: false, error: msg };
  }
}

export async function sendExamResultEmail(input: {
  email: string;
  fullName?: string;
  phone?: string;
  examCode: string;
  locale: Locale;
  result: TestResult;
  questionSnapshots: QuestionSnapshot[];
}): Promise<{ success: boolean; claimToken?: string; error?: string | null }> {
  try {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-exam-result-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        fullName: input.fullName?.trim() || "",
        phone: input.phone?.trim() || "",
        examCode: input.examCode,
        locale: input.locale,
        result: input.result,
        questionSnapshots: input.questionSnapshots,
      }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error_code || "EMAIL_FAILED" };
    }

    return { success: true, claimToken: json.claimToken };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "NETWORK_ERROR";
    return { success: false, error: msg };
  }
}
