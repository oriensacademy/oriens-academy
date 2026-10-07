import { getSupabaseClient } from "@/lib/supabase/client";
import { packageDisplayName } from "@/lib/packages/display";

// Gelir İstatistikleri (Mali akış) için ödeme dışı okumalar: aktif paketlerdeki
// kullanılmamış ders hakları ve yenileme adayları. Yalnız okuma; defter, paket
// veya ders hakkı kaydı değiştirilmez.

export interface StudentPackageStanding {
  studentId: string;
  studentName: string;
  /** Son paketin görünen adı; hiç paketi yoksa null. */
  packageLabel: string | null;
  /** Aktif paketlerdeki kullanılmamış ders hakkı. */
  remaining: number;
  /** Ders başı fiyat (katalog paket fiyatı / ders sayısı; özel pakette satın alma fiyatı). */
  lessonPrice: number;
  /** Aynı paketin katalog fiyatı (yenileme tahmini). Özel/bilinmeyen pakette 0. */
  renewalPrice: number;
}

interface PurchaseRow {
  id: string;
  student_user_id: string | null;
  package_id: string;
  custom_package_name: string | null;
  lesson_count: number;
  lessons_used: number;
  price_amount: number | null;
  status: string;
  created_at: string;
}

interface CatalogRow {
  id: string;
  name_tr: string | null;
  lesson_count: number | null;
  price_amount: number | null;
}

export async function listStudentPackageStandings(): Promise<{ data: StudentPackageStanding[]; error: string | null }> {
  const supabase = getSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untyped = supabase as any;
  const [students, purchases, catalog] = await Promise.all([
    supabase.from("student_profiles").select("id,full_name,active,archived_at").eq("active", true).is("archived_at", null).limit(2000),
    untyped
      .from("student_package_purchases")
      .select("id,student_user_id,package_id,custom_package_name,lesson_count,lessons_used,price_amount,status,created_at")
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
      .limit(5000) as Promise<{ data: PurchaseRow[] | null; error: unknown }>,
    supabase.from("pricing_packages").select("id,name_tr,lesson_count,price_amount"),
  ]);
  if (students.error || purchases.error) return { data: [], error: "Paket bilgileri yüklenemedi." };

  const catalogById = new Map(((catalog.data ?? []) as CatalogRow[]).map((row) => [row.id, row]));
  const byStudent = new Map<string, PurchaseRow[]>();
  for (const purchase of purchases.data ?? []) {
    if (!purchase.student_user_id) continue;
    const list = byStudent.get(purchase.student_user_id) ?? [];
    list.push(purchase);
    byStudent.set(purchase.student_user_id, list);
  }

  const data = ((students.data ?? []) as { id: string; full_name: string | null }[]).map((student) => {
    const list = byStudent.get(student.id) ?? [];
    const active = list.filter((p) => p.status === "active" && p.lesson_count - p.lessons_used > 0);
    const latest = active[0] ?? list.find((p) => p.status !== "refunded" && p.status !== "cancelled") ?? null;
    const remaining = active.reduce((sum, p) => sum + Math.max(0, p.lesson_count - p.lessons_used), 0);
    const catalogRow = latest ? catalogById.get(latest.package_id) : undefined;
    const catalogPrice = Number(catalogRow?.price_amount) || 0;
    const catalogLessons = Number(catalogRow?.lesson_count) || 0;
    const lessonPrice = latest
      ? catalogPrice && catalogLessons
        ? catalogPrice / catalogLessons
        : latest.lesson_count > 0 ? (Number(latest.price_amount) || 0) / latest.lesson_count : 0
      : 0;
    return {
      studentId: student.id,
      studentName: student.full_name?.trim() || "—",
      packageLabel: latest
        ? packageDisplayName({ package_id: latest.package_id, custom_package_name: latest.custom_package_name, lesson_count: latest.lesson_count, name_tr: catalogRow?.name_tr })
        : null,
      remaining,
      lessonPrice,
      renewalPrice: catalogPrice,
    };
  });
  return { data, error: null };
}
