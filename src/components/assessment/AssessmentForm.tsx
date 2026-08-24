"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/content/locale-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { CheckCircle2, Loader2, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssessmentForm() {
  const locale = useLocale();
  const isTr = locale === "tr";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetExam, setTargetExam] = useState("IB");
  const [schoolGrade, setSchoolGrade] = useState("");
  const [targetUniversity, setTargetUniversity] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!fullName.trim() || !email.trim()) {
      setErrorMsg(isTr ? "Lütfen gerekli alanları doldurun." : "Please fill in all required fields.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const payloadMessage = isTr
        ? `
[Ön Değerlendirme Formu]
Hedef Sınav: ${targetExam}
Okul / Sınıf: ${schoolGrade || "-"}
Hedef Ülke/Üniversite: ${targetUniversity || "-"}
Hedef Tarih: ${targetDate || "-"}
Telefon: ${phone || "-"}
Notlar / Hedef: ${notes || "-"}
        `.trim()
        : `
[Academic Assessment Form]
Target Exam: ${targetExam}
School / Grade: ${schoolGrade || "-"}
Target Country / University: ${targetUniversity || "-"}
Target Date: ${targetDate || "-"}
Phone: ${phone || "-"}
Notes / Goals: ${notes || "-"}
        `.trim();

      const { error } = await supabase.from("contact_requests").insert({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        subject: `${isTr ? "Ön Değerlendirme" : "Academic Assessment"} — ${targetExam}`,
        message: payloadMessage,
        locale,
        status: "new",
      });

      if (error) {
        console.error("[AssessmentForm] Error submitting form:", error);
        setErrorMsg(isTr ? "Gönderim sırasında bir hata oluştu." : "An error occurred while submitting.");
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);
    } catch (err) {
      console.error("[AssessmentForm] Unexpected error:", err);
      setErrorMsg(isTr ? "Beklenmeyen bir hata oluştu." : "An unexpected error occurred.");
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="p-8 md:p-12 rounded-2xl border border-primary/30 bg-surface-muted text-center space-y-4 max-w-xl mx-auto my-8 shadow-sm">
        <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <CheckCircle2 className="size-6" />
        </div>
        <h3 className="font-heading text-2xl font-normal text-ink">
          {isTr ? "Değerlendirme Talebiniz Alındı" : "Assessment Request Received"}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed font-sans">
          {isTr
            ? "Talebiniz ekibimize ulaştı. Akademik profilinizi ve hedeflerinizi inceleyip en kısa sürede sizinle iletişime geçeceğiz."
            : "Your request has been received. We will review your academic goals and contact you shortly."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 md:p-10 rounded-2xl border border-border bg-card shadow-sm space-y-6 max-w-2xl mx-auto">
      {errorMsg && (
        <div role="alert" className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 font-sans">
          <ShieldAlert className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="assessment-name" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
            {isTr ? "Ad Soyad" : "Full Name"} <span className="text-destructive">*</span>
          </label>
          <input
            id="assessment-name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={isTr ? "Adınız Soyadınız" : "Your full name"}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
          />
        </div>

        <div>
          <label htmlFor="assessment-email" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
            {isTr ? "E-Posta Adresi" : "Email Address"} <span className="text-destructive">*</span>
          </label>
          <input
            id="assessment-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={isTr ? "E-posta adresiniz" : "Your email address"}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="assessment-exam" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
            {isTr ? "Hazırlandığınız / Hedeflediğiniz Sınav" : "Target Exam"}
          </label>
          <select
            id="assessment-exam"
            value={targetExam}
            onChange={(e) => setTargetExam(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
          >
            <option value="IB">IB (International Baccalaureate)</option>
            <option value="SAT">Digital SAT</option>
            <option value="AP">AP (Advanced Placement)</option>
            <option value="ESAT">ESAT (Engineering & Science)</option>
            <option value="TARA">TARA</option>
            <option value="TMUA">TMUA Mathematics</option>
            <option value="IGCSE">IGCSE / GCSE</option>
            <option value="GRE">GRE</option>
            <option value="GMAT">GMAT Focus Edition</option>
            <option value="UCAT">UCAT / UKCAT</option>
            <option value="IMAT">IMAT (Italy Medicine)</option>
            <option value="OMPT">OMPT (Netherlands Math)</option>
            <option value="Diger">{isTr ? "Diğer / Genel Akademik" : "Other / General Academic"}</option>
          </select>
        </div>

        <div>
          <label htmlFor="assessment-grade" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
            {isTr ? "Okul / Sınıf Seviyesi" : "School / Grade"}
          </label>
          <input
            id="assessment-grade"
            type="text"
            value={schoolGrade}
            onChange={(e) => setSchoolGrade(e.target.value)}
            placeholder={isTr ? "Okulunuz ve sınıfınız" : "Your school and grade"}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label htmlFor="assessment-uni" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
            {isTr ? "Hedef Ülke / Üniversite (İsteğe Bağlı)" : "Target Country / University (Optional)"}
          </label>
          <input
            id="assessment-uni"
            type="text"
            value={targetUniversity}
            onChange={(e) => setTargetUniversity(e.target.value)}
            placeholder={isTr ? "Hedef ülke ve üniversiteler" : "Target countries and universities"}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
          />
        </div>

        <div>
          <label htmlFor="assessment-date" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
            {isTr ? "Hedef Sınav Tarihi (İsteğe Bağlı)" : "Target Exam Date (Optional)"}
          </label>
          <input
            id="assessment-date"
            type="text"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            placeholder={isTr ? "Hedef sınav tarihi" : "Target exam date"}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
          />
        </div>
      </div>

      <div>
        <label htmlFor="assessment-phone" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
          {isTr ? "Telefon Numarası (İsteğe Bağlı)" : "Phone Number (Optional)"}
        </label>
        <input
          id="assessment-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans"
        />
      </div>

      <div>
        <label htmlFor="assessment-notes" className="block text-xs font-bold text-foreground uppercase tracking-wider font-ui mb-2">
          {isTr ? "Hedefiniz / Akademik Notlarınız" : "Your Academic Goals & Notes"}
        </label>
        <textarea
          id="assessment-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isTr ? "Mevcut seviyeniz, zorlandığınız konular veya akademik hedefleriniz..." : "Your current level, topics you want to improve, or goals..."}
          className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-sans resize-none"
        />
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full h-12 text-xs font-bold font-ui uppercase tracking-wider gap-2 cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin text-primary-foreground" />
            <span>{isTr ? "Gönderiliyor..." : "Submitting..."}</span>
          </>
        ) : (
          <>
            <Send className="size-4 text-primary-foreground" />
            <span>{isTr ? "Ön Değerlendirme Talebi Gönder" : "Submit Assessment Request"}</span>
          </>
        )}
      </Button>
    </form>
  );
}
