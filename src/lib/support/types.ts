export type SupportCategory =
  | "general"
  | "academic"
  | "booking"
  | "homework"
  | "package"
  | "payment"
  | "technical"
  | "other";

export type SupportStatus =
  | "open"
  | "waiting_student"
  | "waiting_support"
  | "resolved"
  | "closed";

export type SupportPriority = "low" | "normal" | "high" | "urgent";

export type SenderType = "student" | "admin" | "system";

export type SupportThread = {
  id: string;
  student_user_id: string;
  subject: string;
  category: SupportCategory;
  status: SupportStatus;
  priority: SupportPriority;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  student_last_read_at: string | null;
  admin_last_read_at: string | null;
  student_profiles?: {
    full_name: string;
    email: string;
    phone?: string | null;
  } | null;
  unread_for_student?: boolean;
  unread_for_admin?: boolean;
};

export type SupportMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string | null;
  sender_type: SenderType;
  body: string;
  created_at: string;
  edited_at: string | null;
};

export type CreateThreadInput = {
  student_user_id: string;
  subject: string;
  category: SupportCategory;
  initial_message: string;
};

export const SUPPORT_CATEGORIES: Array<{
  id: SupportCategory;
  labelTr: string;
  labelEn: string;
}> = [
  { id: "general", labelTr: "Genel Destek", labelEn: "General Support" },
  { id: "academic", labelTr: "Ders / Akademik", labelEn: "Lesson / Academic" },
  { id: "booking", labelTr: "Randevu", labelEn: "Appointment" },
  { id: "homework", labelTr: "Ödev", labelEn: "Homework" },
  { id: "package", labelTr: "Paket", labelEn: "Package" },
  { id: "payment", labelTr: "Ödeme", labelEn: "Payment" },
  { id: "technical", labelTr: "Teknik Sorun", labelEn: "Technical Issue" },
  { id: "other", labelTr: "Diğer", labelEn: "Other" },
];

export const SUPPORT_STATUS_LABELS: Record<
  SupportStatus,
  { tr: string; en: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  open: { tr: "Açık", en: "Open", variant: "default" },
  waiting_student: { tr: "Öğrenci Yanıtı Bekleniyor", en: "Awaiting Student", variant: "secondary" },
  waiting_support: { tr: "Destek Yanıtı Bekleniyor", en: "Awaiting Support", variant: "outline" },
  resolved: { tr: "Çözüldü", en: "Resolved", variant: "secondary" },
  closed: { tr: "Kapalı", en: "Closed", variant: "secondary" },
};
