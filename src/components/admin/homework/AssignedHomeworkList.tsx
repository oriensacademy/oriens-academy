"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Clock,
  Eye,
  FileText,
  Plus,
  Search,
  User,
} from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { SubmissionGradingModal } from "./SubmissionGradingModal";

interface AssignedRow {
  id: string;
  title: string;
  description: string;
  status: string;
  due_date: string | null;
  created_at: string;
  submitted_at: string | null;
  teacher_feedback: string | null;
  assignment_file_url: string | null;
  student: {
    id: string;
    fullName: string;
    email: string;
  };
}

export function AssignedHomeworkList({
  onOpenAssignModal,
  filterSubmissionsOnly = false,
}: {
  onOpenAssignModal?: () => void;
  filterSubmissionsOnly?: boolean;
}) {
  const [rows, setRows] = useState<AssignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    filterSubmissionsOnly ? "submitted" : ""
  );

  // Review modal state
  const [gradingId, setGradingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const client = getSupabaseClient();

    let query = client
      .from("student_homework" as never)
      .select("id, title, description, status, due_date, created_at, submitted_at, teacher_feedback, assignment_file_url, student_user_id")
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    } else if (filterSubmissionsOnly) {
      query = query.in("status", ["submitted", "reviewed"]);
    }

    query.then(async ({ data: homeworks, error: hErr }) => {
      if (!active) return;
      if (hErr) {
        setError(hErr.message);
        setLoading(false);
        return;
      }

      const rawHw = (homeworks || []) as unknown as Array<{
        id: string;
        title: string;
        description: string;
        status: string;
        due_date: string | null;
        created_at: string;
        submitted_at: string | null;
        teacher_feedback: string | null;
        assignment_file_url: string | null;
        student_user_id: string;
      }>;

      const userIds = Array.from(new Set(rawHw.map((h) => h.student_user_id)));
      const profileMap: Record<string, { fullName: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await client
          .from("student_profiles" as never)
          .select("id, full_name, email")
          .in("id", userIds);

        if (!active) return;
        const rawProf = (profiles || []) as unknown as Array<{
          id: string;
          full_name: string | null;
          email: string;
        }>;

        rawProf.forEach((p) => {
          profileMap[p.id] = {
            fullName: p.full_name || "Öğrenci",
            email: p.email,
          };
        });
      }

      const combined: AssignedRow[] = rawHw.map((h) => ({
        id: h.id,
        title: h.title,
        description: h.description,
        status: h.status,
        due_date: h.due_date,
        created_at: h.created_at,
        submitted_at: h.submitted_at,
        teacher_feedback: h.teacher_feedback,
        assignment_file_url: h.assignment_file_url,
        student: {
          id: h.student_user_id,
          fullName: profileMap[h.student_user_id]?.fullName || "Kayıtlı Öğrenci",
          email: profileMap[h.student_user_id]?.email || "—",
        },
      }));

      setRows(combined);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [statusFilter, filterSubmissionsOnly]);

  const refreshData = async () => {
    setLoading(true);
    setError("");
    const client = getSupabaseClient();

    let query = client
      .from("student_homework" as never)
      .select("id, title, description, status, due_date, created_at, submitted_at, teacher_feedback, assignment_file_url, student_user_id")
      .order("created_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    } else if (filterSubmissionsOnly) {
      query = query.in("status", ["submitted", "reviewed"]);
    }

    const { data: homeworks, error: hErr } = await query;
    if (hErr) {
      setError(hErr.message);
      setLoading(false);
      return;
    }

    const rawHw = (homeworks || []) as unknown as Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      due_date: string | null;
      created_at: string;
      submitted_at: string | null;
      teacher_feedback: string | null;
      assignment_file_url: string | null;
      student_user_id: string;
    }>;

    const userIds = Array.from(new Set(rawHw.map((h) => h.student_user_id)));
    const profileMap: Record<string, { fullName: string; email: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await client
        .from("student_profiles" as never)
        .select("id, full_name, email")
        .in("id", userIds);

      const rawProf = (profiles || []) as unknown as Array<{
        id: string;
        full_name: string | null;
        email: string;
      }>;

      rawProf.forEach((p) => {
        profileMap[p.id] = {
          fullName: p.full_name || "Öğrenci",
          email: p.email,
        };
      });
    }

    const combined: AssignedRow[] = rawHw.map((h) => ({
      id: h.id,
      title: h.title,
      description: h.description,
      status: h.status,
      due_date: h.due_date,
      created_at: h.created_at,
      submitted_at: h.submitted_at,
      teacher_feedback: h.teacher_feedback,
      assignment_file_url: h.assignment_file_url,
      student: {
        id: h.student_user_id,
        fullName: profileMap[h.student_user_id]?.fullName || "Kayıtlı Öğrenci",
        email: profileMap[h.student_user_id]?.email || "—",
      },
    }));

    setRows(combined);
    setLoading(false);
  };

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.title.toLowerCase().includes(q) ||
      r.student.fullName.toLowerCase().includes(q) ||
      r.student.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Search & Status Filter */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Ödev adı, öğrenci adı veya e-posta ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-white pl-9 pr-3 py-2 text-xs text-ink outline-hidden focus:border-primary"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-xl border border-input bg-white px-3 py-2 text-xs text-ink outline-hidden focus:border-primary font-medium"
        >
          <option value="">Tüm Durumlar</option>
          <option value="assigned">Atandı (Bekliyor)</option>
          <option value="in_progress">Devam Eden</option>
          <option value="submitted">Teslim Edildi (İnceleme Bekliyor)</option>
          <option value="reviewed">Değerlendirildi</option>
          <option value="overdue">Süresi Geçti</option>
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-border bg-white p-12 text-center text-xs text-muted-foreground">
          Ödev kayıtları yükleniyor...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-white p-12 text-center space-y-3">
          <FileText className="mx-auto size-8 text-muted-foreground/50" />
          <div className="text-sm font-semibold text-ink">
            {filterSubmissionsOnly
              ? "İncelenecek teslim kaydı bulunmuyor"
              : "Kayıtlı atanmış ödev bulunamadı"}
          </div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {filterSubmissionsOnly
              ? "Öğrenciler ödevlerini teslim ettiklerinde bu ekranda listelenecektir."
              : "Öğrencilere hazır şablonlardan veya soru bankasından ödev atayabilirsiniz."}
          </p>
          {onOpenAssignModal && !filterSubmissionsOnly && (
            <button
              onClick={onOpenAssignModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white hover:bg-forest"
            >
              <Plus className="size-4" /> Ödev Ata
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isSubmitted = item.status === "submitted";
            const isReviewed = item.status === "reviewed";
            return (
              <div
                key={item.id}
                className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center shadow-2xs transition-all ${
                  isSubmitted
                    ? "border-amber-300 bg-amber-50/20"
                    : isReviewed
                    ? "border-emerald-200 bg-white"
                    : "border-border bg-white"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs font-bold text-ink">
                      <User className="size-3.5 text-muted-foreground" />
                      {item.student.fullName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      ({item.student.email})
                    </span>
                    <StatusBadge status={item.status} />
                  </div>

                  <h3 className="text-sm font-semibold text-ink">{item.title}</h3>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>
                      Atandı: {new Date(item.created_at).toLocaleDateString("tr-TR")}
                    </span>
                    {item.due_date && (
                      <span className="flex items-center gap-1 font-medium text-ink">
                        <Clock className="size-3 text-muted-foreground" />
                        Son Teslim: {new Date(item.due_date).toLocaleString("tr-TR")}
                      </span>
                    )}
                    {item.submitted_at && (
                      <span className="font-semibold text-emerald-800">
                        Teslim: {new Date(item.submitted_at).toLocaleString("tr-TR")}
                      </span>
                    )}
                  </div>

                  {item.teacher_feedback && (
                    <div className="mt-1 text-[11px] text-emerald-950 font-medium bg-emerald-50/70 border border-emerald-200 rounded-lg px-2.5 py-1 inline-block">
                      <strong>Geri Bildirim:</strong> {item.teacher_feedback}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGradingId(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer shadow-xs ${
                      isSubmitted
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "border border-border bg-white text-ink hover:bg-surface-muted"
                    }`}
                  >
                    <Eye className="size-3.5" />
                    {isSubmitted
                      ? "Teslimi İncele & Puanla"
                      : isReviewed
                      ? "Değerlendirmeyi Gör"
                      : "Detay / Yanıtlar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submission Grading Modal */}
      {gradingId && (
        <SubmissionGradingModal
          homeworkId={gradingId}
          onClose={() => setGradingId(null)}
          onGraded={() => {
            refreshData();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "assigned":
      return (
        <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 uppercase">
          Atandı
        </span>
      );
    case "in_progress":
      return (
        <span className="rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 uppercase">
          Devam Ediyor
        </span>
      );
    case "submitted":
      return (
        <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
          Teslim Edildi
        </span>
      );
    case "reviewed":
      return (
        <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 uppercase">
          Değerlendirildi
        </span>
      );
    case "overdue":
      return (
        <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold text-red-800 uppercase">
          Gecikti
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold text-neutral-800 uppercase">
          {status}
        </span>
      );
  }
}
