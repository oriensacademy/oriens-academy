import type { Locale } from "./dictionaries";

export const studentCopy = {
  tr: {
    login: "Öğrenci Girişi", register: "Öğrenci Kaydı", email: "E-posta", password: "Şifre", passwordAgain: "Şifre Tekrar",
    fullName: "Ad Soyad", phone: "Telefon", school: "Okul (isteğe bağlı)", targetExam: "Hedef Sınav (isteğe bağlı)", targetCountry: "Hedef Ülke (isteğe bağlı)",
    loginAction: "Giriş Yap", registerAction: "Hesap Oluştur", noAccount: "Hesabınız yok mu?", hasAccount: "Zaten hesabınız var mı?",
    registrationReceived: "Kayıt işleminiz alındı. Hesabınızı doğrulamak için e-posta adresinizi kontrol edin.",
    accountCreated: "Hesabınız oluşturuldu ve oturumunuz açıldı.", terms: "Gizlilik Politikası ve Kullanım Koşulları'nı kabul ediyorum.",
    genericError: "İşlem tamamlanamadı. Bilgilerinizi kontrol edip yeniden deneyin.", studentOnly: "Bu giriş alanı yalnızca öğrenci hesapları içindir.",
    tabs: ["Genel Bakış", "Profilim", "Randevularım", "Derslerim", "Ödevlerim", "Paketim", "Ödemelerim"],
  },
  en: {
    login: "Student Login", register: "Student Registration", email: "Email", password: "Password", passwordAgain: "Confirm Password",
    fullName: "Full Name", phone: "Phone", school: "School (optional)", targetExam: "Target Exam (optional)", targetCountry: "Target Country (optional)",
    loginAction: "Log In", registerAction: "Create Account", noAccount: "No account yet?", hasAccount: "Already have an account?",
    registrationReceived: "Your registration has been received. Check your email to verify your account.",
    accountCreated: "Your account has been created and you are signed in.", terms: "I accept the Privacy Policy and Terms of Service.",
    genericError: "The request could not be completed. Check your details and try again.", studentOnly: "This login is for student accounts only.",
    tabs: ["Overview", "Profile", "Appointments", "Lessons", "Homework", "My Package", "Payments"],
  },
} as const;

export function getStudentCopy(locale: Locale) { return studentCopy[locale]; }
