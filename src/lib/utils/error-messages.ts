export type Locale = "tr" | "en";

interface ErrorMapping {
  test: (message: string) => boolean;
  tr: string;
  en: string;
}

const ERROR_PATTERNS: ErrorMapping[] = [
  {
    test: (msg) => /unable to validate email address|invalid format|invalid email/i.test(msg),
    tr: "Geçersiz e-posta formatı. Lütfen kontrol edip tekrar deneyiniz.",
    en: "Invalid email address format. Please verify and try again.",
  },
  {
    test: (msg) => /user already registered|already exists|email address is already in use/i.test(msg),
    tr: "Bu e-posta adresi ile kayıtlı bir hesap zaten mevcut. Lütfen oturum açınız.",
    en: "An account with this email already exists. Please sign in.",
  },
  {
    test: (msg) => /invalid login credentials|invalid credentials|wrong password/i.test(msg),
    tr: "E-posta adresi veya şifre hatalı. Lütfen bilgilerinizi kontrol ediniz.",
    en: "Invalid email address or password. Please verify your credentials.",
  },
  {
    test: (msg) => /rate limit|too many requests|over email rate limit|security purposes|only request this once/i.test(msg),
    tr: "Çok fazla deneme yapıldı. Lütfen biraz bekleyip tekrar deneyiniz.",
    en: "Too many requests. Please wait a moment and try again.",
  },
  {
    test: (msg) => /password should be at least|password too short/i.test(msg),
    tr: "Şifreniz en az 6 karakter uzunluğunda olmalıdır.",
    en: "Password must be at least 6 characters long.",
  },
  {
    test: (msg) => /network error|failed to fetch|networkrequestfailed|fetch failed/i.test(msg),
    tr: "Bağlantı hatası oluştu. Lütfen internet bağlantınızı kontrol ediniz.",
    en: "Network error occurred. Please check your connection and try again.",
  },
  {
    test: (msg) => /session expired|invalid session|token expired|jwt expired/i.test(msg),
    tr: "Oturum süreniz doldu. Lütfen tekrar giriş yapınız.",
    en: "Your session has expired. Please sign in again.",
  },
  {
    test: (msg) => /otp.*expired|token has expired/i.test(msg),
    tr: "Doğrulama bağlantısının veya kodunun süresi dolmuş. Lütfen yeni kod isteyiniz.",
    en: "Verification link or code has expired. Please request a new code.",
  },
  {
    test: (msg) => /invalid.*otp|verification failed/i.test(msg),
    tr: "Doğrulama kodu geçersiz. Lütfen girdiğiniz kodu kontrol ediniz.",
    en: "Invalid verification code. Please check the code and try again.",
  },
  {
    test: (msg) => /email not confirmed|email_not_confirmed/i.test(msg),
    tr: "E-posta adresiniz henüz doğrulanmamış.",
    en: "Your email address has not been verified yet.",
  },
];

/**
 * Returns a user-friendly, localized error string suitable for public display.
 * Never leaks raw English backend or database stack traces when locale is 'tr'.
 */
export function localizeErrorMessage(
  rawError: unknown,
  locale: Locale = "tr",
  customFallback?: string
): string {
  const isTr = locale === "tr";
  let message = "";

  if (typeof rawError === "string") {
    message = rawError;
  } else if (rawError && typeof rawError === "object") {
    if ("message" in rawError && typeof (rawError as { message: unknown }).message === "string") {
      message = (rawError as { message: string }).message;
    } else if ("error" in rawError && typeof (rawError as { error: unknown }).error === "string") {
      message = (rawError as { error: string }).error;
    } else if ("code" in rawError && typeof (rawError as { code: unknown }).code === "string") {
      message = (rawError as { code: string }).code;
    }
  }

  const clean = message.trim();
  if (!clean) {
    return customFallback || (isTr ? "İşlem şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyiniz." : "The request could not be completed right now. Please try again later.");
  }

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(clean)) {
      return isTr ? pattern.tr : pattern.en;
    }
  }

  // If error appears to be in English (contains common ASCII tech words) but user is on TR locale,
  // return friendly Turkish fallback rather than raw English technical string.
  if (isTr && /^[A-Za-z0-9\s:._,'"-]+$/.test(clean) && !/[çğıöşüÇĞİÖŞÜ]/.test(clean)) {
    return customFallback || "İşlem şu anda tamamlanamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyiniz.";
  }

  return clean;
}
