import type { Locale } from "./dictionaries";

export const studentCopy = {
  tr: {
    login: "Oturum Aç", register: "Öğrenci Kaydı", email: "E-posta", password: "Şifre", passwordAgain: "Şifre Tekrar",
    fullName: "Ad Soyad", phone: "Telefon", school: "Okul (isteğe bağlı)", targetExam: "Hedef Sınav (isteğe bağlı)", targetCountry: "Hedef Ülke (isteğe bağlı)",
    loginAction: "Giriş Yap", registerAction: "Hesap Oluştur", noAccount: "Hesabınız yok mu?", hasAccount: "Zaten hesabınız var mı?",
    registrationReceived: "Kayıt işleminiz alındı. Hesabınızı doğrulamak için e-posta adresinizi kontrol edin.",
    accountCreated: "Hesabınız oluşturuldu ve oturumunuz açıldı.", terms: "Gizlilik Politikası ve Kullanım Koşulları'nı kabul ediyorum.",
    genericError: "İşlem tamamlanamadı. Bilgilerinizi kontrol edip yeniden deneyin.", studentOnly: "Bu hesap için aktif bir Oriens Academy profili bulunamadı.",
    tabs: ["Genel Bakış", "Profilim", "Randevularım", "Derslerim", "Ödevlerim", "Paketim", "Ödemelerim", "Destek"],
  },
  en: {
    login: "Sign In", register: "Student Registration", email: "Email", password: "Password", passwordAgain: "Confirm Password",
    fullName: "Full Name", phone: "Phone", school: "School (optional)", targetExam: "Target Exam (optional)", targetCountry: "Target Country (optional)",
    loginAction: "Log In", registerAction: "Create Account", noAccount: "No account yet?", hasAccount: "Already have an account?",
    registrationReceived: "Your registration has been received. Check your email to verify your account.",
    accountCreated: "Your account has been created and you are signed in.", terms: "I accept the Privacy Policy and Terms of Service.",
    genericError: "The request could not be completed. Check your details and try again.", studentOnly: "No active Oriens Academy profile was found for this account.",
    tabs: ["Overview", "Profile", "Appointments", "Lessons", "Homework", "My Package", "Payments", "Support"],
  },
} as const;

export function getStudentCopy(locale: Locale) { return studentCopy[locale]; }
