import { getSupabaseClient } from "@/lib/supabase/client";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import type { Json, Tables } from "@/types/database.types";
import type { BookingWithSlot } from "./bookings";
import { packageDisplayName } from "@/lib/packages/display";
import { reportAdminFailure, writeAdminAuditLog } from "@/lib/admin/audit";
import { normalizeStudentPhone } from "@/lib/format/phone";
import { listGuardianLastSignIns } from "@/lib/admin/logins";

export type StudentContact = Tables<"contact_requests">;
export type StudentDelivery = Tables<"notification_deliveries">;

export interface StudentProfile {
  id: string;
  userId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  emails: string[];
  phones: string[];
  interests: string[];
  contacts: StudentContact[];
  bookings: BookingWithSlot[];
  deliveries: StudentDelivery[];
  latestActivity: string;
  latestContact: string | null;
  latestAppointment: string | null;
  context: "student_account" | "booking" | "quick_contact" | "contact_only";
  active: boolean;
  archived: boolean;
  /** Arşive taşınma zamanı (yalnızca öğrenci hesapları). */
  archivedAt?: string | null;
  /** Son arşivleme denetim kaydındaki neden / kısa açıklama (referans arc-why). */
  archiveReason?: string | null;
  archiveNote?: string | null;
  targetExam: string | null;
  targetExams: string[];
  targetCountry: string | null;
  targetCountries: string[];
  activePackage: { id: string; name: string; lessonCount: number; lessonsUsed: number } | null;
  nextAppointment: string | null;
  pendingHomework: number;
  school: string | null;
  gradeLevel: string | null;
  educationProgram: string | null;
  lastLessonDate: string | null;
  examsTaken: string[];
  targetUniversity: string | null;
  preferredLanguage: string;
  relationshipRole: "self" | "parent" | "guardian" | "other" | null;
  guardianUserId: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  /** Panelden girilen veli telefonu (student_profiles.contact_guardian_phone). */
  contactGuardianPhone?: string | null;
  guardianLastSignIn: string | null;
}

export type GuardianLinkedStudent = {
  id: string;
  fullName: string;
  phone: string | null;
  school: string | null;
  gradeLevel: string | null;
  relationshipRole: "self" | "parent" | "guardian" | "other";
  isPrimary: boolean;
  active: boolean;
};

export async function listGuardianLinkedStudents(guardianUserId: string) {
  const supabase = getSupabaseClient();
  // The relationship is canonical; names are read from student_profiles and
  // never inferred from the guardian account.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("guardian_students")
    .select("student_id,relationship_role,is_primary,active,student_profiles!inner(id,full_name,phone,school,grade_level,active)")
    .eq("guardian_user_id", guardianUserId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return { data: [] as GuardianLinkedStudent[], error: error.message };
  const rows = (data || []).map((row: Record<string, unknown>) => {
    const profile = row.student_profiles as { id: string; full_name: string; phone: string | null; school: string | null; grade_level: string | null; active: boolean };
    return {
      id: profile.id,
      fullName: profile.full_name,
      phone: profile.phone,
      school: profile.school,
      gradeLevel: profile.grade_level,
      relationshipRole: row.relationship_role as GuardianLinkedStudent["relationshipRole"],
      isPrimary: Boolean(row.is_primary),
      active: Boolean(row.active) && profile.active,
    };
  });
  return { data: rows, error: null };
}

export async function adminCreateStudentForGuardian(
  guardianUserId: string,
  fullName: string,
  relationshipRole: GuardianLinkedStudent["relationshipRole"] = "parent",
  gradeLevel: string | null = null
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_create_student_for_guardian_with_grade", {
    p_guardian_user_id: guardianUserId,
    p_student_full_name: fullName.trim(),
    p_relationship_role: relationshipRole,
    p_grade_level: gradeLevel,
  });
  const result = data as { success?: boolean; error_code?: string; student_id?: string } | null;
  if (error || !result?.success) {
    const messages: Record<string, string> = {
      INVALID_STUDENT_NAME: "Öğrenci adı 2–100 karakter arasında olmalıdır.",
      GUARDIAN_NOT_FOUND: "Aktif veli hesabı bulunamadı.",
      GRADE_UNAVAILABLE: "Seçilen sınıf artık kullanılamıyor.",
    };
    return { success: false, error: error?.message || messages[result?.error_code || ""] || "Öğrenci oluşturulamadı." };
  }
  return { success: true, error: null, studentId: result.student_id };
}

export interface AdminCreateStudentInput {
  requestId: string;
  fullName: string;
  school: string;
  gradeLevel: string;
  educationProgram: string;
  examsTaken?: string[];
  guardianName: string;
  guardianPhone?: string;
  phone: string;
  email: string;
}

/**
 * Panelden yeni öğrenci kaydı (tek RPC, tek transaction). Auth kullanıcısı,
 * veli hesabı, paket, ödeme veya e-posta oluşturmaz. Aynı `requestId` ile
 * yapılan tekrar çağrılar ilk kaydı döndürür (çift tıklama koruması).
 */
export async function adminCreateStudent(input: AdminCreateStudentInput): Promise<{ success: boolean; error: string | null; studentId?: string; replayed?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_create_student", {
    p_request_id: input.requestId,
    p_full_name: input.fullName.trim().replace(/\s+/g, " "),
    p_school: input.school.trim() || null,
    p_grade_level: input.gradeLevel || null,
    p_education_program: input.educationProgram.trim() || null,
    p_exams_taken: input.examsTaken ?? [],
    p_guardian_name: input.guardianName.trim() || null,
    p_phone: studentPhonePayload(input.phone),
    p_email: input.email.trim().toLowerCase() || null,
    p_guardian_phone: studentPhonePayload(input.guardianPhone),
  });
  const result = data as { success?: boolean; error_code?: string; student_id?: string; replayed?: boolean } | null;
  if (error || !result?.success) {
    const messages: Record<string, string> = {
      INVALID_STUDENT_NAME: "Öğrenci adı 2–100 karakter arasında olmalıdır.",
      INVALID_GUARDIAN_NAME: "Veli adı 2–100 karakter arasında olmalıdır.",
      INVALID_EMAIL: "Geçerli bir e-posta adresi girin.",
      INVALID_PHONE: "Geçerli bir telefon numarası girin.",
      INVALID_GUARDIAN_PHONE: "Geçerli bir veli telefonu girin.",
      GRADE_UNAVAILABLE: "Seçilen sınıf artık kullanılamıyor.",
      INVALID_EXAMS: "Sınav listesi geçersiz.",
      DUPLICATE_STUDENT: "Bu ad ve e-posta ile kayıtlı aktif bir öğrenci zaten var.",
      REQUEST_ID_REQUIRED: "İstek doğrulanamadı, lütfen tekrar deneyin.",
    };
    if (error) void reportAdminFailure({ action: "student.create_failed", category: "student", operation: "admin_create_student", error, entityType: "student_profile", correlationId: `admin_create_student:${input.requestId}` });
    return { success: false, error: messages[result?.error_code || ""] || "Öğrenci oluşturulamadı." };
  }
  return { success: true, error: null, studentId: result.student_id, replayed: Boolean(result.replayed) };
}

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || "";
export const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") || "";
  if (!digits) return "";
  return digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.replace(/^0/, "");
};

export async function listAdminStudents(params: { archived?: boolean } = {}): Promise<{ data: StudentProfile[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const showArchived = Boolean(params.archived);
  const [profilesResult, contactsResult, bookingsResult, deliveriesResult, purchasesResult, homeworkResult, guardianLinksResult, lessonsResult, guardianSignInsResult] = await Promise.all([
    supabase.from("student_profiles").select("*").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("contact_requests").select("*").eq("is_archived", showArchived).order("created_at", { ascending: false }).limit(1000),
    supabase.from("bookings").select("*, availability_slots(id, starts_at, ends_at, status)").order("created_at", { ascending: false }).limit(1000),
    // Bu liste yalnızca öğrenci başına teslimat SAYISI için kullanılıyor
    // (StudentDetailSheet başlığı). `select("*")` ile 2000 satırın tüm
    // kolonlarını çekmek, ölçümde tüm Kullanıcılar sayfasını ~1.9 sn boyunca
    // `Promise.all` içinde bekleten en yavaş sorguydu. Eşleştirme için gereken
    // iki kolon yeterli.
    supabase.from("notification_deliveries").select("id,entity_id").eq("is_archived", false).order("created_at", { ascending: false }).limit(2000),
    supabase.from("student_package_purchases").select("id,student_user_id,package_id,lesson_count,lessons_used,status,pricing_packages(name_tr,name_en)").eq("is_archived", false).order("created_at", { ascending: false }).limit(2000),
    supabase.from("student_homework").select("student_user_id,status").in("status", ["assigned", "in_progress", "submitted", "overdue"]),
    supabase.from("guardian_students").select("guardian_user_id,student_id,relationship_role,is_primary,active,guardian_accounts(full_name,email,phone)").eq("active", true),
    supabase
      .from("student_lessons")
      .select("student_user_id,lesson_date")
      .eq("status", "completed")
      .eq("is_archived", false)
      .lte("lesson_date", new Date().toISOString())
      .order("lesson_date", { ascending: false })
      .limit(10000),
    listGuardianLastSignIns(),
  ]);

  const firstError = profilesResult.error || contactsResult.error || bookingsResult.error || deliveriesResult.error || purchasesResult.error || homeworkResult.error || guardianLinksResult.error || lessonsResult.error;
  if (firstError) {
    void reportAdminFailure({ action: "admin.data_load_failed", category: "admin", operation: "list_admin_students", error: firstError, entityType: "student_profile" });
    return { data: [], error: firstError.message };
  }

  const contacts = (contactsResult.data || []) as StudentContact[];
  const bookings = (bookingsResult.data || []) as unknown as BookingWithSlot[];
  const deliveries = (deliveriesResult.data || []) as StudentDelivery[];
  const profiles: StudentProfile[] = [];
  const emailMap = new Map<string, StudentProfile>();
  const phoneMap = new Map<string, StudentProfile>();
  const hiddenRegisteredEmails = new Set<string>();
  const hiddenRegisteredPhones = new Set<string>();
  const latestLessonByUser = new Map<string, string>();

  (lessonsResult.data || []).forEach((lesson) => {
    if (!latestLessonByUser.has(lesson.student_user_id)) {
      latestLessonByUser.set(lesson.student_user_id, lesson.lesson_date);
    }
  });

  (profilesResult.data || []).forEach((account) => {
    const archived = Boolean((account as unknown as { archived_at?: string | null }).archived_at);
    if (archived === showArchived) return;
    const email = normalizeEmail(account.email);
    const phone = normalizePhone(account.phone);
    if (email) hiddenRegisteredEmails.add(email);
    if (phone) hiddenRegisteredPhones.add(phone);
  });

  const guardianLinkMap = new Map<string, { guardian_user_id: string; relationship_role: string; guardian_accounts: { full_name?: string; email?: string; phone?: string } | null }>();
  (guardianLinksResult.data || []).forEach((row: Record<string, unknown>) => {
    const studentId = String(row.student_id || "");
    if (studentId && (!guardianLinkMap.has(studentId) || row.is_primary)) {
      guardianLinkMap.set(studentId, row as unknown as { guardian_user_id: string; relationship_role: string; guardian_accounts: { full_name?: string; email?: string; phone?: string } | null });
    }
  });

  (profilesResult.data || []).forEach((account) => {
    const archived = Boolean((account as unknown as { archived_at?: string | null }).archived_at);
    if (archived !== showArchived) return;
    const email = normalizeEmail(account.email);
    const phone = normalizePhone(account.phone);
    const accountRecord = account as unknown as Record<string, unknown>;
    const rawExams = accountRecord.target_exams;
    const rawCountries = accountRecord.target_countries;
    const rawExamsTaken = accountRecord.exams_taken;
    const targetExams: string[] = Array.isArray(rawExams) && rawExams.length > 0
      ? rawExams
      : account.target_exam ? [account.target_exam] : [];
    const targetCountries: string[] = Array.isArray(rawCountries) && rawCountries.length > 0
      ? rawCountries
      : account.target_country ? [account.target_country] : [];

    const link = guardianLinkMap.get(account.id);
    const profile: StudentProfile = {
      id: `account-${account.id}`,
      userId: account.id,
      fullName: account.full_name,
      email: account.email,
      phone: account.phone,
      emails: email ? [email] : [],
      phones: phone ? [phone] : [],
      interests: targetExams.length > 0 ? targetExams : (account.target_exam ? [account.target_exam] : []),
      contacts: [],
      bookings: [],
      deliveries: [],
      latestActivity: account.updated_at,
      latestContact: null,
      latestAppointment: null,
      context: "student_account",
      active: account.active,
      archived,
      archivedAt: (account as unknown as { archived_at?: string | null }).archived_at ?? null,
      targetExam: account.target_exam || (targetExams[0] || null),
      targetExams,
      targetCountry: account.target_country || (targetCountries[0] || null),
      targetCountries,
      activePackage: null,
      nextAppointment: null,
      pendingHomework: 0,
      school: account.school,
      gradeLevel: typeof accountRecord.grade_level === "string" ? accountRecord.grade_level : null,
      educationProgram: typeof accountRecord.education_program === "string" ? accountRecord.education_program : null,
      lastLessonDate: latestLessonByUser.get(account.id) || null,
      examsTaken: Array.isArray(rawExamsTaken) ? rawExamsTaken.filter((value): value is string => typeof value === "string") : [],
      targetUniversity: account.target_university,
      preferredLanguage: account.preferred_language,
      relationshipRole: (link?.relationship_role as "self" | "parent" | "guardian" | "other") || null,
      guardianUserId: link?.guardian_user_id || null,
      // Veli hesabı bağlı değilse panelden eklenirken girilen iletişim kişisi.
      guardianName: (link?.guardian_accounts as { full_name?: string })?.full_name || (typeof accountRecord.contact_guardian_name === "string" ? accountRecord.contact_guardian_name : null),
      guardianEmail: (link?.guardian_accounts as { email?: string })?.email || null,
      // Veli hesabındaki telefon yoksa panelden girilen veli telefonu.
      guardianPhone: (link?.guardian_accounts as { phone?: string })?.phone || (typeof accountRecord.contact_guardian_phone === "string" ? accountRecord.contact_guardian_phone : null),
      contactGuardianPhone: typeof accountRecord.contact_guardian_phone === "string" ? accountRecord.contact_guardian_phone : null,
      guardianLastSignIn: link?.guardian_user_id ? guardianSignInsResult.data.get(link.guardian_user_id) ?? null : null,
    };
    profiles.push(profile);
    if (email) emailMap.set(email, profile);
    if (phone) phoneMap.set(phone, profile);
  });

  const getProfile = (record: { id: string; full_name: string; email: string; phone: string | null; created_at: string }, allowSynthetic = true): StudentProfile | null => {
    const email = normalizeEmail(record.email);
    const phone = normalizePhone(record.phone);
    if (!showArchived && (hiddenRegisteredEmails.has(email) || (phone && hiddenRegisteredPhones.has(phone)))) return null;
    let profile = emailMap.get(email);
    const phoneProfile = phone ? phoneMap.get(phone) : undefined;

    // A phone match is accepted only when it does not conflict with a known email.
    if (!profile && phoneProfile && (!email || phoneProfile.emails.includes(email))) profile = phoneProfile;
    if (!profile && !allowSynthetic) return null;
    if (!profile) {
      profile = {
        id: `person-${record.id}`,
        userId: null,
        fullName: record.full_name,
        email: record.email,
        phone: record.phone,
        emails: [],
        phones: [],
        interests: [],
        contacts: [],
        bookings: [],
        deliveries: [],
        latestActivity: record.created_at,
        latestContact: null,
        latestAppointment: null,
        context: "contact_only",
        active: false,
        archived: showArchived,
        targetExam: null,
        targetExams: [],
        targetCountry: null,
        targetCountries: [],
        activePackage: null,
        nextAppointment: null,
        pendingHomework: 0,
        school: null,
        gradeLevel: null,
        educationProgram: null,
        lastLessonDate: null,
        examsTaken: [],
        targetUniversity: null,
        preferredLanguage: "tr",
        relationshipRole: null,
        guardianUserId: null,
        guardianName: null,
        guardianEmail: null,
        guardianPhone: null,
        guardianLastSignIn: null,
      };
      profiles.push(profile);
    }
    if (email && !profile.emails.includes(email)) profile.emails.push(email);
    if (phone && !profile.phones.includes(phone)) profile.phones.push(phone);
    if (!profile.phone && record.phone) profile.phone = record.phone;
    if (new Date(record.created_at) > new Date(profile.latestActivity)) {
      profile.latestActivity = record.created_at;
      profile.fullName = record.full_name || profile.fullName;
      profile.email = record.email || profile.email;
    }
    if (email) emailMap.set(email, profile);
    if (phone && (!phoneMap.has(phone) || phoneMap.get(phone) === profile)) phoneMap.set(phone, profile);
    return profile;
  };

  contacts.forEach((contact) => {
    const profile = getProfile(contact);
    if (!profile) return;
    profile.contacts.push(contact);
    if (!profile.latestContact || contact.created_at > profile.latestContact) profile.latestContact = contact.created_at;
    if (contact.subject && !profile.interests.includes(contact.subject)) profile.interests.push(contact.subject);
    if (contact.source === "quick_contact" && profile.context === "contact_only") profile.context = "quick_contact";
  });

  bookings.forEach((booking) => {
    const profile = getProfile(booking, !showArchived);
    if (!profile) return;
    profile.bookings.push(booking);
    if (profile.context !== "student_account") profile.context = "booking";
    const interest = booking.exam_code || booking.custom_exam;
    if (interest && !profile.interests.includes(interest)) profile.interests.push(interest);
    const appointment = booking.availability_slots?.starts_at || null;
    if (appointment && (!profile.latestAppointment || appointment > profile.latestAppointment)) profile.latestAppointment = appointment;
  });

  const deliveryByEntity = new Map<string, StudentDelivery[]>();
  deliveries.forEach((delivery) => {
    const current = deliveryByEntity.get(delivery.entity_id) || [];
    current.push(delivery);
    deliveryByEntity.set(delivery.entity_id, current);
  });
  profiles.forEach((profile) => {
    const entityIds = [...profile.contacts, ...profile.bookings].map((record) => record.id);
    profile.deliveries = entityIds.flatMap((id) => deliveryByEntity.get(id) || []);
    profile.contacts.sort((a, b) => b.created_at.localeCompare(a.created_at));
    profile.bookings.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const future = profile.bookings
      .map((booking) => booking.availability_slots?.starts_at || null)
      .filter((date): date is string => Boolean(date) && new Date(date as string).getTime() >= Date.now())
      .sort();
    profile.nextAppointment = future[0] || null;
  });

  type PurchaseJoin = { id: string; student_user_id: string | null; package_id: string; lesson_count: number; lessons_used: number; status: string; pricing_packages: { name_tr: string | null; name_en: string | null } | null };
  const purchasesByUser = new Map<string, PurchaseJoin[]>();
  ((purchasesResult.data || []) as unknown as PurchaseJoin[]).forEach((purchase) => {
    if (!purchase.student_user_id) return;
    const list = purchasesByUser.get(purchase.student_user_id) || [];
    list.push(purchase);
    purchasesByUser.set(purchase.student_user_id, list);
  });

  profiles.forEach((profile) => {
    if (!profile.userId) return;
    const userPurchases = purchasesByUser.get(profile.userId) || [];
    const activePurchases = userPurchases.filter(
      (p) => p.status === "active" && p.lesson_count - p.lessons_used > 0
    );
    const totalGranted = userPurchases.reduce((s, p) => s + (p.lesson_count || 0), 0);
    const totalUsed = userPurchases.reduce((s, p) => s + (p.lessons_used || 0), 0);
    const totalRemaining = activePurchases.reduce(
      (s, p) => s + Math.max(0, p.lesson_count - p.lessons_used),
      0
    );

    if (activePurchases.length > 1) {
      profile.activePackage = {
        id: activePurchases[0].id,
        name: `${activePurchases.length} Aktif Paket · ${totalRemaining} ders kaldı`,
        lessonCount: totalGranted,
        lessonsUsed: totalUsed,
      };
    } else if (activePurchases.length === 1) {
      const p = activePurchases[0];
      profile.activePackage = {
        id: p.id,
        name: packageDisplayName({
          package_id: p.package_id,
          lesson_count: p.lesson_count,
          name_tr: p.pricing_packages?.name_tr,
          name_en: p.pricing_packages?.name_en,
        }, "tr"),
        lessonCount: p.lesson_count,
        lessonsUsed: p.lessons_used,
      };
    }
  });
  (homeworkResult.data || []).forEach((item) => {
    const profile = profiles.find((candidate) => candidate.userId === item.student_user_id);
    if (profile) profile.pendingHomework += 1;
  });

  // Arşiv nedeni ayrı kolonda tutulmaz; son member_archived denetim kaydının
  // metadata'sından okunur (salt okuma, yalnızca arşiv listesi).
  const archivedIds = showArchived ? profiles.filter((profile) => profile.archived && profile.userId).map((profile) => profile.userId as string) : [];
  if (archivedIds.length) {
    const { data: archiveRows } = await supabase
      .from("audit_logs")
      .select("entity_id,metadata,created_at")
      .eq("action", "member_archived")
      .in("entity_id", archivedIds.slice(0, 500))
      .order("created_at", { ascending: false })
      .limit(1000);
    const latest = new Map<string, Record<string, unknown>>();
    (archiveRows || []).forEach((row) => {
      if (row.entity_id && !latest.has(row.entity_id)) latest.set(row.entity_id, (row.metadata as Record<string, unknown> | null) || {});
    });
    profiles.forEach((profile) => {
      const meta = profile.userId ? latest.get(profile.userId) : undefined;
      if (!meta) return;
      profile.archiveReason = typeof meta.archive_reason === "string" ? meta.archive_reason : null;
      profile.archiveNote = typeof meta.archive_note === "string" ? meta.archive_note : null;
    });
  }

  return { data: profiles.sort((a, b) => b.latestActivity.localeCompare(a.latestActivity)), error: null };
}

/** Referans arşiv penceresindeki neden seçenekleri (oriens-admin #arc-dialog). */
export const ARCHIVE_REASONS = ["Kaydı bıraktı", "Mezun oldu", "Test kaydı", "Diğer"] as const;
export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export async function archiveAdminMember(
  userId: string,
  archive?: { reason?: ArchiveReason | null; note?: string | null }
): Promise<{ success: boolean; error: string | null }> {
  // Generated RPC types are refreshed after migration promotion.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_archive_member_with_reason", {
    p_user_id: userId,
    p_reason: archive?.reason || null,
    p_note: archive?.note?.trim() || null,
  });
  const result = data as { success?: boolean } | null;
  if (error || result?.success !== true) void reportAdminFailure({ action: "student.archive_failed", category: "student", operation: "admin_archive_member", error: error || { message: "Archive not confirmed" }, entityType: "student_profile", entityId: userId });
  return { success: !error && result?.success === true, error: error?.message || null };
}

export async function restoreAdminMember(userId: string): Promise<{ success: boolean; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (getSupabaseClient() as any).rpc("admin_restore_member", { p_user_id: userId });
  const result = data as { success?: boolean } | null;
  if (error || result?.success !== true) void reportAdminFailure({ action: "student.restore_failed", category: "student", operation: "admin_restore_member", error: error || { message: "Restore not confirmed" }, entityType: "student_profile", entityId: userId });
  return { success: !error && result?.success === true, error: error?.message || null };
}

/**
 * Sends a secure Supabase Auth password recovery link to the student's verified email
 * via canonical requestPasswordRecovery helper.
 * Does NOT generate any plaintext passwords.
 */
export async function sendStudentPasswordReset(
  studentEmail: string,
  locale: "tr" | "en" = "tr"
): Promise<{ success: boolean; error: string | null }> {
  try {
    const cleanEmail = studentEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, error: "Geçerli bir e-posta adresi bulunamadı." };
    }

    const res = await requestPasswordRecovery({
      email: cleanEmail,
      locale,
    });

    if (!res.success) {
      return {
        success: false,
        error: res.error || "Şifre sıfırlama bağlantısı gönderilemedi.",
      };
    }

    // Log admin audit event (without token)
    try {
      const supabase = getSupabaseClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("audit_logs") as any).insert({
        action: "student.password_reset_sent",
        entity_type: "student",
        metadata: {
          email: cleanEmail,
          locale,
          requested_at: new Date().toISOString(),
        },
      });
    } catch {
      // Safe fallback
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Şifre sıfırlama bağlantısı gönderilemedi.",
    };
  }
}

/** Kanonik "905XXXXXXXXX"; boş → null. Çözümlenemeyen değer sunucuya ham gider ve INVALID_PHONE ile reddedilir. */
function studentPhonePayload(value: string | null | undefined): string | null {
  const phone = normalizeStudentPhone(value);
  return phone === undefined ? String(value ?? "").trim() : phone;
}

/**
 * Updates a student's personal identity and academic profile securely via Admin RPC with audit logging.
 */
export async function adminUpdateStudentProfile(
  studentId: string,
  input: {
    fullName: string;
    phone?: string | null;
    guardianPhone?: string | null;
    school?: string | null;
    gradeLevel?: string | null;
    educationProgram?: string | null;
    examsTaken?: string[];
    preferredLanguage?: string;
    active?: boolean;
  }
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    const changes: Record<string, Json | undefined> = { full_name: input.fullName.trim() };
    if ("phone" in input) changes.phone = studentPhonePayload(input.phone);
    if ("guardianPhone" in input) changes.contact_guardian_phone = studentPhonePayload(input.guardianPhone);
    if ("school" in input) changes.school = input.school?.trim() || null;
    if ("gradeLevel" in input) changes.grade_level = input.gradeLevel?.trim() || null;
    if ("educationProgram" in input) changes.education_program = input.educationProgram?.trim() || null;
    if ("examsTaken" in input) changes.exams_taken = input.examsTaken || [];
    if ("preferredLanguage" in input) changes.preferred_language = input.preferredLanguage || "tr";
    if ("active" in input) changes.active = input.active ?? true;
    const { data, error } = await supabase.rpc("admin_update_student_form_profile", {
      p_student_id: studentId,
      p_changes: changes,
    });
    if (error) { void reportAdminFailure({action:"student.update_failed",category:"student",operation:"admin_update_student_profile",error,entityType:"student_profile",entityId:studentId}); return { success: false, error: error.message }; }
    const result = data as { success?: boolean; error_code?: string } | null;
    if (!result || result.success !== true) {
      const messages: Record<string, string> = {
        GRADE_UNAVAILABLE: "Seçilen sınıf artık kullanılamıyor.",
        INVALID_INPUT: "Öğrenci bilgileri geçersiz.",
        INVALID_PHONE: "Geçerli bir telefon numarası girin.",
        INVALID_GUARDIAN_PHONE: "Geçerli bir veli telefonu girin.",
        NOT_FOUND: "Öğrenci bulunamadı.",
      };
      void reportAdminFailure({action:"student.update_failed",category:"student",operation:"admin_update_student_profile",error:{message:"Update not confirmed"},entityType:"student_profile",entityId:studentId});
      return { success: false, error: messages[result?.error_code || ""] || "Güncelleme doğrulanamadı." };
    }
    return { success: true, error: null };
  } catch (err) {
    void reportAdminFailure({action:"student.update_failed",category:"student",operation:"admin_update_student_profile",error:err,entityType:"student_profile",entityId:studentId});
    return { success: false, error: err instanceof Error ? err.message : "Güncelleme başarısız oldu." };
  }
}

export async function adminUpdateGuardianName(
  guardianUserId: string,
  fullName: string
): Promise<{ success: boolean; error: string | null }> {
  const cleanName = fullName.trim();
  if (!guardianUserId || !cleanName) return { success: false, error: "Veli adı zorunludur." };
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("guardian_accounts").update({ full_name: cleanName }).eq("user_id", guardianUserId);
  if (error) {
    void reportAdminFailure({ action: "student.guardian_update_failed", category: "student", operation: "admin_update_guardian_name", error, entityType: "guardian_account", entityId: guardianUserId });
    return { success: false, error: error.message };
  }
  await writeAdminAuditLog({ action: "student.guardian_identity_updated", category: "student", entityType: "guardian_account", entityId: guardianUserId, metadata: { field: "full_name" } });
  return { success: true, error: null };
}

export type StudentGradeOption = {
  id: string;
  label: string;
  active: boolean;
  sort_order: number;
};

export type StudentExamOption = {
  id: string;
  label: string;
  active: boolean;
  sort_order: number;
};

export async function listStudentExamOptions(): Promise<{ data: StudentExamOption[]; error: string | null }> {
  const { data, error } = await getSupabaseClient()
    .from("student_exam_options")
    .select("id,label,active,sort_order")
    .order("sort_order")
    .order("id");
  return error
    ? { data: [], error: error.message }
    : { data: (data || []) as StudentExamOption[], error: null };
}

export async function manageStudentExamOption(input: {
  action: "create" | "rename" | "activate" | "deactivate" | "reorder";
  id?: string;
  label?: string;
  sortOrder?: number;
}): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc("admin_manage_student_exam_option", {
    p_action: input.action,
    p_id: input.id || null,
    p_label: input.label || null,
    p_sort_order: input.sortOrder ?? null,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success?: boolean; error_code?: string } | null;
  if (result?.success) return { success: true, error: null };
  const messages: Record<string, string> = {
    DUPLICATE_LABEL: "Bu sınav seçeneği zaten mevcut.",
    INVALID_LABEL: "Sınav adı 1–80 karakter arasında olmalıdır.",
    NOT_FOUND: "Sınav seçeneği bulunamadı.",
  };
  return { success: false, error: messages[result?.error_code || ""] || "Sınav seçeneği güncellenemedi." };
}

export async function listStudentGradeOptions(): Promise<{ data: StudentGradeOption[]; error: string | null }> {
  const { data, error } = await getSupabaseClient()
    .from("student_grade_options")
    .select("id,label,active,sort_order")
    .order("sort_order")
    .order("id");
  return error
    ? { data: [], error: error.message }
    : { data: (data || []) as StudentGradeOption[], error: null };
}

export async function manageStudentGradeOption(input: {
  action: "create" | "rename" | "activate" | "deactivate" | "reorder";
  id?: string;
  label?: string;
  sortOrder?: number;
}): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await getSupabaseClient().rpc("admin_manage_student_grade_option", {
    p_action: input.action,
    p_id: input.id || null,
    p_label: input.label || null,
    p_sort_order: input.sortOrder ?? null,
  });
  if (error) return { success: false, error: error.message };
  const result = data as { success?: boolean; error_code?: string } | null;
  if (result?.success) return { success: true, error: null };
  const messages: Record<string, string> = {
    DUPLICATE_LABEL: "Bu sınıf seçeneği zaten mevcut.",
    INVALID_LABEL: "Sınıf adı 1–120 karakter arasında olmalıdır.",
    NOT_FOUND: "Sınıf seçeneği bulunamadı.",
  };
  return { success: false, error: messages[result?.error_code || ""] || "Sınıf seçeneği güncellenemedi." };
}

/**
 * Updates a student's guardian relationship role (self, parent, guardian, other) via Admin RPC with audit logging.
 */
export async function adminUpdateGuardianRelationship(
  studentId: string,
  relationshipRole: "self" | "parent" | "guardian" | "other",
  guardianUserId?: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_update_guardian_relationship", {
      p_student_id: studentId,
      p_relationship_role: relationshipRole,
      p_guardian_user_id: guardianUserId ?? null,
    });
    if (error) return { success: false, error: error.message };
    const res = data as { success?: boolean; error_code?: string };
    if (!res?.success) return { success: false, error: res?.error_code || "İlişki güncellenemedi." };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "İlişki güncellenemedi." };
  }
}
