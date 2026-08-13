export type ContactRequestPayload = {
  fullName: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  locale: "tr" | "en";
  privacyConsent: boolean;
  turnstileToken?: string;
  source?: "website" | "quick_contact" | "consultation";
};

export type ContactSuccessResponse = {
  success: true;
  contactId: string;
  message: string;
};

export type ContactErrorResponse = {
  success: false;
  errorCode:
    | "INVALID_FULL_NAME"
    | "INVALID_EMAIL"
    | "INVALID_MESSAGE"
    | "PRIVACY_CONSENT_REQUIRED"
    | "STORAGE_FAILED"
    | "NETWORK_ERROR"
    | "INTERNAL_ERROR";
  message: string;
};

export type ContactResult = ContactSuccessResponse | ContactErrorResponse;
