import { getSupabaseClient } from "@/lib/supabase/client";

// Denetim > Girişler: auth_login_events (yalnız admin okur; IP tutulmaz).

export interface AdminLoginEvent {
  id: number;
  userId: string | null;
  email: string;
  name: string | null;
  role: "veli" | "yonetici";
  result: "ok" | "fail";
  device: string | null;
  at: string;
  /** Veli girişlerinde öğrenci detayına bağlantı için birincil öğrenci. */
  studentId: string | null;
  studentName: string | null;
}

interface LoginEventRow {
  id: number;
  user_id: string | null;
  email: string;
  role: "veli" | "yonetici";
  result: "ok" | "fail";
  device: string | null;
  created_at: string;
}

export async function listAdminLoginEvents(): Promise<{ data: AdminLoginEvent[]; guardianCount: number; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabaseClient() as any;
  const since = new Date(Date.now() - 366 * 86_400_000).toISOString();
  const res = (await supabase
    .from("auth_login_events")
    .select("id,user_id,email,role,result,device,created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(3000)) as { data: LoginEventRow[] | null; error: unknown };
  if (res.error) return { data: [], guardianCount: 0, error: "Giriş kayıtları yüklenemedi." };
  const rows = res.data ?? [];
  const links = (await supabase
    .from("guardian_students")
    .select("guardian_user_id,student_id,is_primary")
    .eq("active", true)) as { data: { guardian_user_id: string; student_id: string; is_primary: boolean | null }[] | null };
  const studentByGuardian = new Map<string, string>();
  for (const link of links.data ?? []) {
    if (link.is_primary || !studentByGuardian.has(link.guardian_user_id)) studentByGuardian.set(link.guardian_user_id, link.student_id);
  }
  const studentNames = new Map<string, string>();
  const linkedStudentIds = Array.from(new Set(rows.map((row) => (row.user_id ? studentByGuardian.get(row.user_id) : undefined)).filter((id): id is string => Boolean(id))));
  if (linkedStudentIds.length) {
    const students = (await supabase.from("student_profiles").select("id,full_name").in("id", linkedStudentIds)) as { data: { id: string; full_name: string | null }[] | null };
    for (const student of students.data ?? []) if (student.full_name?.trim()) studentNames.set(student.id, student.full_name.trim());
  }
  const ids = Array.from(new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id))));
  const names = new Map<string, string>();
  if (ids.length) {
    const [guardians, admins] = await Promise.all([
      supabase.from("guardian_accounts").select("user_id,full_name").in("user_id", ids) as Promise<{ data: { user_id: string; full_name: string | null }[] | null }>,
      supabase.from("admin_profiles").select("user_id,display_name").in("user_id", ids) as Promise<{ data: { user_id: string; display_name: string | null }[] | null }>,
    ]);
    for (const g of guardians.data ?? []) if (g.full_name?.trim()) names.set(g.user_id, g.full_name.trim());
    for (const a of admins.data ?? []) if (a.display_name?.trim() && !names.has(a.user_id)) names.set(a.user_id, a.display_name.trim());
  }
  return {
    data: rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.user_id ? names.get(row.user_id) ?? null : null,
      role: row.role,
      result: row.result,
      device: row.device,
      at: row.created_at,
      studentId: row.user_id && row.role === "veli" ? studentByGuardian.get(row.user_id) ?? null : null,
      studentName: row.user_id && row.role === "veli" ? studentNames.get(studentByGuardian.get(row.user_id) ?? "") ?? null : null,
    })),
    guardianCount: studentByGuardian.size,
    error: null,
  };
}

/** Aktif velilerin son başarılı giriş zamanı (auth.users.last_sign_in_at). */
export async function listGuardianLastSignIns(): Promise<{ data: Map<string, string | null>; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (getSupabaseClient() as any).rpc("admin_guardian_last_sign_ins")) as { data: { user_id: string; last_sign_in_at: string | null }[] | null; error: unknown };
  if (res.error) return { data: new Map(), error: "Son giriş bilgileri yüklenemedi." };
  return { data: new Map((res.data ?? []).map((row) => [row.user_id, row.last_sign_in_at])), error: null };
}
