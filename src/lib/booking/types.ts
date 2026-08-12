export type PublicAvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
};

export type SupportType =
  | "exam_preparation"
  | "university_support"
  | "general_consultation";

export type BookingRequestPayload = {
  slotId: string;
  fullName: string;
  email: string;
  phone?: string;
  supportType: SupportType;
  examCode?: string;
  customExam?: string;
  notes?: string;
  locale: "tr" | "en";
  privacyConsent: boolean;
  marketingConsent?: boolean;
  turnstileToken?: string;
};

export type BookingSuccessResponse = {
  success: true;
  bookingId: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type BookingErrorResponse = {
  success: false;
  errorCode:
    | "SLOT_UNAVAILABLE"
    | "SLOT_NOT_FOUND"
    | "INVALID_PAYLOAD"
    | "PRIVACY_CONSENT_REQUIRED"
    | "RESERVATION_FAILED"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
};

export type BookingResult = BookingSuccessResponse | BookingErrorResponse;
