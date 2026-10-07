// admin@oriens-academy.com is a recipient/BCC-archive address only -- it must
// never be used as an outbound sender/From address (business rule).
export const ADMIN_EMAIL = "admin@oriens-academy.com";
export const INFO_EMAIL = "info@oriens-academy.com";

export const CANONICAL_EMAILS = [ADMIN_EMAIL, INFO_EMAIL] as const;
