import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  CreateThreadInput,
  SupportMessage,
  SupportThread,
} from "./types";

type GenericClient = {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: unknown) => {
        order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      order: (col: string, opts?: { ascending?: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    insert: (values: unknown) => {
      select: () => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (values: unknown) => {
      eq: (col: string, val: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export async function listStudentThreads(studentUserId: string): Promise<{
  data: SupportThread[] | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericClient;
    const { data, error } = await supabase
      .from("support_threads")
      .select("*")
      .eq("student_user_id", studentUserId)
      .order("last_message_at", { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    const threads = ((data || []) as unknown as SupportThread[]).map((t) => {
      const isUnread =
        Boolean(t.last_message_at && t.student_last_read_at
          ? new Date(t.last_message_at) > new Date(t.student_last_read_at)
          : false) && t.status === "waiting_student";

      return {
        ...t,
        unread_for_student: isUnread,
      };
    });

    return { data: threads, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function createSupportThread(input: CreateThreadInput): Promise<{
  data: { thread: SupportThread; message: SupportMessage } | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericClient;
    
    // 1. Create thread
    const { data: threadData, error: threadError } = await supabase
      .from("support_threads")
      .insert({
        student_user_id: input.student_user_id,
        subject: input.subject.trim(),
        category: input.category,
        status: "open",
        priority: "normal",
        last_message_at: new Date().toISOString(),
        student_last_read_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (threadError || !threadData) {
      return { data: null, error: threadError?.message || "THREAD_CREATION_FAILED" };
    }

    const thread = threadData as unknown as SupportThread;

    // 2. Insert initial message
    const { data: msgData, error: msgError } = await supabase
      .from("support_messages")
      .insert({
        thread_id: thread.id,
        sender_user_id: input.student_user_id,
        sender_type: "student",
        body: input.initial_message.trim(),
      })
      .select()
      .single();

    if (msgError || !msgData) {
      return { data: null, error: msgError?.message || "MESSAGE_CREATION_FAILED" };
    }

    // 3. Trigger confirmation email to student asynchronously (non-blocking)
    try {
      const realClient = getSupabaseClient();
      void realClient.functions.invoke("send-support-email", {
        body: {
          threadId: thread.id,
          locale: input.locale || "tr",
        },
      }).catch((emailErr) => {
        console.warn("[support] Confirmation email dispatch failed:", emailErr);
      });
    } catch {
      // Non-blocking email dispatch
    }

    return {
      data: {
        thread,
        message: msgData as unknown as SupportMessage,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function listThreadMessages(threadId: string): Promise<{
  data: SupportMessage[] | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericClient;
    const { data, error } = await supabase
      .from("support_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data || []) as unknown as SupportMessage[], error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function sendStudentMessage(
  threadId: string,
  studentUserId: string,
  body: string
): Promise<{
  data: SupportMessage | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericClient;
    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        thread_id: threadId,
        sender_user_id: studentUserId,
        sender_type: "student",
        body: body.trim(),
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as unknown as SupportMessage, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function markThreadReadByStudent(threadId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericClient;
    await supabase
      .from("support_threads")
      .update({
        student_last_read_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  } catch {
    // Non-blocking read marker
  }
}

export function subscribeToThreadMessages(
  threadId: string,
  onNewMessage: (msg: SupportMessage) => void
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`support-thread-${threadId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new as unknown as SupportMessage);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToStudentThreads(
  studentUserId: string,
  onUpdate: () => void
): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`student-support-threads-${studentUserId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_threads",
        filter: `student_user_id=eq.${studentUserId}`,
      },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
