import { getSupabaseClient } from "@/lib/supabase/client";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import type { Tables } from "@/types/database.types";
import type { BookingWithSlot } from "./bookings";

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
  targetExam: string | null;
  targetExams: string[];
  targetCountry: string | null;
  targetCountries: string[];
  activePackage: { id: string; name: string; lessonCount: number; lessonsUsed: number } | null;
  nextAppointment: string | null;
  pendingHomework: number;
  school: string | null;
  targetUniversity: string | null;
  preferredLanguage: string;
  relationshipRole: "self" | "parent" | "guardian" | "other" | null;
  guardianUserId: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
}

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || "";
export const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") || "";
  if (!digits) return "";
  return digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.replace(/^0/, "");
};

export async function listAdminStudents(): Promise<{ data: StudentProfile[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const [profilesResult, contactsResult, bookingsResult, deliveriesResult, purchasesResult, homeworkResult, guardianLinksResult] = await Promise.all([
    supabase.from("student_profiles").select("*").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("bookings").select("*, availability_slots(id, starts_at, ends_at, status)").order("created_at", { ascending: false }).limit(1000),
    supabase.from("notification_deliveries").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("student_package_purchases").select("id,student_user_id,lesson_count,lessons_used,status,pricing_packages(name_tr,name_en)").order("created_at", { ascending: false }).limit(2000),
    supabase.from("student_homework").select("student_user_id,status").in("status", ["assigned", "in_progress", "submitted", "overdue"]),
    supabase.from("guardian_students").select("guardian_user_id,student_id,relationship_role,is_primary,active,guardian_accounts(full_name,email)").eq("active", true),
  ]);

  const firstError = profilesResult.error || contactsResult.error || bookingsResult.error || deliveriesResult.error || purchasesResult.error || homeworkResult.error || guardianLinksResult.error;
  if (firstError) return { data: [], error: firstError.message };

  const contacts = (contactsResult.data || []) as StudentContact[];
  const bookings = (bookingsResult.data || []) as unknown as BookingWithSlot[];
  const deliveries = (deliveriesResult.data || []) as StudentDelivery[];
  const profiles: StudentProfile[] = [];
  const emailMap = new Map<string, StudentProfile>();
  const phoneMap = new Map<string, StudentProfile>();

  const guardianLinkMap = new Map<string, { guardian_user_id: string; relationship_role: string; guardian_accounts: { full_name?: string; email?: string } | null }>();
  (guardianLinksResult.data || []).forEach((row: Record<string, unknown>) => {
    const studentId = String(row.student_id || "");
    if (studentId && (!guardianLinkMap.has(studentId) || row.is_primary)) {
      guardianLinkMap.set(studentId, row as unknown as { guardian_user_id: string; relationship_role: string; guardian_accounts: { full_name?: string; email?: string } | null });
    }
  });

  (profilesResult.data || []).forEach((account) => {
    const email = normalizeEmail(account.email);
    const phone = normalizePhone(account.phone);
    const accountRecord = account as unknown as Record<string, unknown>;
    const rawExams = accountRecord.target_exams;
    const rawCountries = accountRecord.target_countries;
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
      targetExam: account.target_exam || (targetExams[0] || null),
      targetExams,
      targetCountry: account.target_country || (targetCountries[0] || null),
      targetCountries,
      activePackage: null,
      nextAppointment: null,
      pendingHomework: 0,
      school: account.school,
      targetUniversity: account.target_university,
      preferredLanguage: account.preferred_language,
      relationshipRole: (link?.relationship_role as "self" | "parent" | "guardian" | "other") || null,
      guardianUserId: link?.guardian_user_id || null,
      guardianName: (link?.guardian_accounts as { full_name?: string })?.full_name || null,
      guardianEmail: (link?.guardian_accounts as { email?: string })?.email || null,
    };
    profiles.push(profile);
    if (email) emailMap.set(email, profile);
    if (phone) phoneMap.set(phone, profile);
  });

  const getProfile = (record: { id: string; full_name: string; email: string; phone: string | null; created_at: string }): StudentProfile => {
    const email = normalizeEmail(record.email);
    const phone = normalizePhone(record.phone);
    let profile = emailMap.get(email);
    const phoneProfile = phone ? phoneMap.get(phone) : undefined;

    // A phone match is accepted only when it does not conflict with a known email.
    if (!profile && phoneProfile && (!email || phoneProfile.emails.includes(email))) profile = phoneProfile;
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
        targetExam: null,
        targetExams: [],
        targetCountry: null,
        targetCountries: [],
        activePackage: null,
        nextAppointment: null,
        pendingHomework: 0,
        school: null,
        targetUniversity: null,
        preferredLanguage: "tr",
        relationshipRole: null,
        guardianUserId: null,
        guardianName: null,
        guardianEmail: null,
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
    profile.contacts.push(contact);
    if (!profile.latestContact || contact.created_at > profile.latestContact) profile.latestContact = contact.created_at;
    if (contact.subject && !profile.interests.includes(contact.subject)) profile.interests.push(contact.subject);
    if (contact.source === "quick_contact" && profile.context === "contact_only") profile.context = "quick_contact";
  });

  bookings.forEach((booking) => {
    const profile = getProfile(booking);
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

  type PurchaseJoin = { id: string; student_user_id: string | null; lesson_count: number; lessons_used: number; status: string; pricing_packages: { name_tr: string | null; name_en: string | null } | null };
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
        name: p.pricing_packages?.name_tr || p.pricing_packages?.name_en || p.id,
        lessonCount: p.lesson_count,
        lessonsUsed: p.lessons_used,
      };
    }
  });
  (homeworkResult.data || []).forEach((item) => {
    const profile = profiles.find((candidate) => candidate.userId === item.student_user_id);
    if (profile) profile.pendingHomework += 1;
  });

  return { data: profiles.sort((a, b) => b.latestActivity.localeCompare(a.latestActivity)), error: null };
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

/**
 * Updates a student's personal identity and academic profile securely via Admin RPC with audit logging.
 */
export async function adminUpdateStudentProfile(
  studentId: string,
  input: {
    fullName: string;
    phone?: string | null;
    school?: string | null;
    targetUniversity?: string | null;
  }
): Promise<{ success: boolean; error: string | null }> {
  const supabase = getSupabaseClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("admin_update_student_profile", {
      p_student_id: studentId,
      p_full_name: input.fullName.trim(),
      p_phone: input.phone ? input.phone.trim() : null,
      p_school: input.school ? input.school.trim() : null,
      p_target_university: input.targetUniversity ? input.targetUniversity.trim() : null,
    });
    if (error) return { success: false, error: error.message };
    if (!data || data.success !== true) return { success: false, error: "Güncelleme doğrulanamadı." };
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Güncelleme başarısız oldu." };
  }
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
