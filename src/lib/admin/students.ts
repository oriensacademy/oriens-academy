import { getSupabaseClient } from "@/lib/supabase/client";
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
  activePackage: { id: string; name: string; lessonCount: number; lessonsUsed: number } | null;
  nextAppointment: string | null;
  pendingHomework: number;
  school: string | null;
  targetUniversity: string | null;
  targetCountry: string | null;
  preferredLanguage: string;
}

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || "";
export const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") || "";
  if (!digits) return "";
  return digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.replace(/^0/, "");
};

export async function listAdminStudents(): Promise<{ data: StudentProfile[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const [profilesResult, contactsResult, bookingsResult, deliveriesResult, purchasesResult, homeworkResult] = await Promise.all([
    supabase.from("student_profiles").select("*").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("bookings").select("*, availability_slots(id, starts_at, ends_at, status)").order("created_at", { ascending: false }).limit(1000),
    supabase.from("notification_deliveries").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("student_package_purchases").select("id,student_user_id,lesson_count,lessons_used,status,pricing_packages(name_tr,name_en)").order("created_at", { ascending: false }).limit(2000),
    supabase.from("student_homework").select("student_user_id,status").in("status", ["assigned", "submitted", "late"]),
  ]);

  const firstError = profilesResult.error || contactsResult.error || bookingsResult.error || deliveriesResult.error || purchasesResult.error || homeworkResult.error;
  if (firstError) return { data: [], error: firstError.message };

  const contacts = (contactsResult.data || []) as StudentContact[];
  const bookings = (bookingsResult.data || []) as unknown as BookingWithSlot[];
  const deliveries = (deliveriesResult.data || []) as StudentDelivery[];
  const profiles: StudentProfile[] = [];
  const emailMap = new Map<string, StudentProfile>();
  const phoneMap = new Map<string, StudentProfile>();

  (profilesResult.data || []).forEach((account) => {
    const email = normalizeEmail(account.email); const phone = normalizePhone(account.phone);
    const profile: StudentProfile = {
      id: `account-${account.id}`, userId: account.id, fullName: account.full_name, email: account.email, phone: account.phone,
      emails: email ? [email] : [], phones: phone ? [phone] : [], interests: account.target_exam ? [account.target_exam] : [],
      contacts: [], bookings: [], deliveries: [], latestActivity: account.updated_at, latestContact: null, latestAppointment: null, context: "student_account",
      active: account.active, targetExam: account.target_exam, activePackage: null, nextAppointment: null, pendingHomework: 0,
      school: account.school, targetUniversity: account.target_university, targetCountry: account.target_country, preferredLanguage: account.preferred_language,
    };
    profiles.push(profile); if (email) emailMap.set(email, profile); if (phone) phoneMap.set(phone, profile);
  });

  const getProfile = (record: { id: string; full_name: string; email: string; phone: string | null; created_at: string }) => {
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
        emails: [], phones: [], interests: [], contacts: [], bookings: [], deliveries: [],
        latestActivity: record.created_at,
        latestContact: null,
        latestAppointment: null,
        context: "contact_only",
        active: false, targetExam: null, activePackage: null, nextAppointment: null, pendingHomework: 0,
        school: null, targetUniversity: null, targetCountry: null, preferredLanguage: "tr",
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
  ((purchasesResult.data || []) as unknown as PurchaseJoin[]).forEach((purchase) => {
    if (purchase.status !== "active" || !purchase.student_user_id) return;
    const profile = profiles.find((item) => item.userId === purchase.student_user_id);
    if (profile && !profile.activePackage) profile.activePackage = { id: purchase.id, name: purchase.pricing_packages?.name_tr || purchase.pricing_packages?.name_en || purchase.id, lessonCount: purchase.lesson_count, lessonsUsed: purchase.lessons_used };
  });
  (homeworkResult.data || []).forEach((item) => {
    const profile = profiles.find((candidate) => candidate.userId === item.student_user_id);
    if (profile) profile.pendingHomework += 1;
  });

  return { data: profiles.sort((a, b) => b.latestActivity.localeCompare(a.latestActivity)), error: null };
}
