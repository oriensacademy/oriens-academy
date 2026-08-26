export type ContactRequestPayload = {
  fullName: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  locale: "tr" | "en";
  privacyConsent: boolean;
  turnstileToken?: string;
  company_website?: string;
  source: "contact_form" | "quick_contact" | "consultation";
  packageId?: string;
};

export type ContactSuccessResponse = {
  success: true;
  contactId: string;
  message: string;
  deliveryStatus: "sent" | "partial";
};

export type ContactErrorResponse = {
  success: false;
  errorCode:
    | "INVALID_FULL_NAME"
    | "INVALID_EMAIL"
    | "INVALID_PHONE"
    | "INVALID_SUBJECT"
    | "INVALID_MESSAGE"
    | "INVALID_PACKAGE"
    | "PRIVACY_CONSENT_REQUIRED"
    | "BOT_VERIFICATION_REQUIRED"
    | "BOT_VERIFICATION_FAILED"
    | "BOT_VERIFICATION_EXPIRED"
    | "TEMPORARY_ERROR"
    | "FORBIDDEN_ORIGIN"
    | "RATE_LIMITED"
    | "SERVER_CONFIG_ERROR"
    | "STORAGE_FAILED"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
};

export type ContactResult = ContactSuccessResponse | ContactErrorResponse;
