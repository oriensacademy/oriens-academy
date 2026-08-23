import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  SupportMessage,
  SupportStatus,
  SupportThread,
} from "./types";

type GenericAdminClient = {
  from: (table: string) => {
    select: (cols?: string) => {
      in: (col: string, vals: unknown[]) => {
        eq: (col: string, val: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
      } & Promise<{ data: unknown; error: { message: string } | null }>;
      eq: (col: string, val: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
      order: (col: string, opts?: { ascending?: boolean }) => {
        in: (col: string, vals: unknown[]) => {
          eq: (col: string, val: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
        } & Promise<{ data: unknown; error: { message: string } | null }>;
        eq: (col: string, val: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
      } & Promise<{ data: unknown; error: { message: string } | null }>;
    };
    insert: (values: unknown) => {
      select: () => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (values: unknown) => {
      eq: (col: string, val: unknown) => {
        select: () => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      } & Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };
};

export async function listAdminSupportThreads(filters?: {
  status?: string;
  category?: string;
  search?: string;
}): Promise<{
  data: SupportThread[] | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericAdminClient;
    let query: Promise<{ data: unknown; error: { message: string } | null }> = supabase
      .from("support_threads")
      .select(`
        *,
        student_profiles:student_user_id (
          full_name,
          email,
          phone
        )
      `)
      .order("last_message_at", { ascending: false });

    if (filters?.status && filters.status !== "all") {
      const q = supabase.from("support_threads").select(`*, student_profiles:student_user_id (full_name, email, phone)`).order("last_message_at", { ascending: false });
      if (filters.status === "open") {
        query = q.in("status", ["open", "waiting_support", "waiting_student"]);
      } else if (filters.status === "waiting_support") {
        query = q.eq("status", "waiting_support");
      } else if (filters.status === "resolved") {
        query = q.in("status", ["resolved", "closed"]);
      } else {
        query = q.eq("status", filters.status);
      }
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: error.message };
    }

    let threads = ((data || []) as unknown as SupportThread[]).map((t) => {
      const isUnread =
        Boolean(t.last_message_at && t.admin_last_read_at
          ? new Date(t.last_message_at) > new Date(t.admin_last_read_at)
          : true) && t.status === "waiting_support";

      return {
        ...t,
        unread_for_admin: isUnread,
      };
    });

    if (filters?.category && filters.category !== "all") {
      threads = threads.filter((t) => t.category === filters.category);
    }

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      threads = threads.filter((t) => {
        const studentName = t.student_profiles?.full_name?.toLowerCase() || "";
        const studentEmail = t.student_profiles?.email?.toLowerCase() || "";
        const subject = t.subject.toLowerCase();
        return (
          studentName.includes(term) ||
          studentEmail.includes(term) ||
          subject.includes(term)
        );
      });
    }

    return { data: threads, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function updateSupportThreadStatus(
  threadId: string,
  status: SupportStatus
): Promise<{
  data: SupportThread | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericAdminClient;
    const { data, error } = await supabase
      .from("support_threads")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as unknown as SupportThread, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "UNKNOWN_ERROR",
    };
  }
}

export async function sendAdminSupportMessage(
  threadId: string,
  adminUserId: string,
  body: string
): Promise<{
  data: SupportMessage | null;
  error: string | null;
}> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericAdminClient;
    const { data, error } = await supabase
      .from("support_messages")
      .insert({
        thread_id: threadId,
        sender_user_id: adminUserId,
        sender_type: "admin",
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

export async function markThreadReadByAdmin(threadId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient() as unknown as GenericAdminClient;
    await supabase
      .from("support_threads")
      .update({
        admin_last_read_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  } catch {
    // Non-blocking read marker
  }
}

export function subscribeToAllSupportThreads(onUpdate: () => void): () => void {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel("admin-all-support-threads")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "support_threads",
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
