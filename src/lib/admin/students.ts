import { getSupabaseClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";
import type { BookingWithSlot } from "./bookings";

export type StudentContact = Tables<"contact_requests">;
export type StudentDelivery = Tables<"notification_deliveries">;

export interface StudentProfile {
  id: string;
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
  context: "booking" | "quick_contact" | "contact_only";
}

const normalizeEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || "";
export const normalizePhone = (value: string | null | undefined) => {
  const digits = value?.replace(/\D/g, "") || "";
  if (!digits) return "";
  return digits.startsWith("90") && digits.length === 12 ? digits.slice(2) : digits.replace(/^0/, "");
};

export async function listAdminStudents(): Promise<{ data: StudentProfile[]; error: string | null }> {
  const supabase = getSupabaseClient();
  const [contactsResult, bookingsResult, deliveriesResult] = await Promise.all([
    supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("bookings").select("*, availability_slots(id, starts_at, ends_at, status)").order("created_at", { ascending: false }).limit(1000),
    supabase.from("notification_deliveries").select("*").order("created_at", { ascending: false }).limit(2000),
  ]);

  const firstError = contactsResult.error || bookingsResult.error || deliveriesResult.error;
  if (firstError) return { data: [], error: firstError.message };

  const contacts = (contactsResult.data || []) as StudentContact[];
  const bookings = (bookingsResult.data || []) as unknown as BookingWithSlot[];
  const deliveries = (deliveriesResult.data || []) as StudentDelivery[];
  const profiles: StudentProfile[] = [];
  const emailMap = new Map<string, StudentProfile>();
  const phoneMap = new Map<string, StudentProfile>();

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
        fullName: record.full_name,
        email: record.email,
        phone: record.phone,
        emails: [], phones: [], interests: [], contacts: [], bookings: [], deliveries: [],
        latestActivity: record.created_at,
        latestContact: null,
        latestAppointment: null,
        context: "contact_only",
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
    profile.context = "booking";
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
  });

  return { data: profiles.sort((a, b) => b.latestActivity.localeCompare(a.latestActivity)), error: null };
}
