"use client";

import type { ReactNode } from "react";
import { BarChart3, BookOpenCheck, CreditCard, FileText, Headphones, ShieldCheck } from "lucide-react";
import { useSiteContact } from "@/lib/contact-settings";
import styles from "./auth-experience.module.css";

type Locale = "tr" | "en";

const FEATURES = {
  tr: [
    { title: "Ders kayıtları", body: "Yapılan her dersin tarihi, süresi ve konusu", icon: BookOpenCheck },
    { title: "Ders raporları", body: "Her dersten sonra öğretmen notu, ödev ve gelişim özeti", icon: FileText },
    { title: "Kalan ders hakkı", body: "Paketinizde kaç ders kaldığı, anlık olarak", icon: BarChart3 },
    { title: "Paket ve ödemeler", body: "Yeni paket satın alma ve ödeme geçmişi", icon: CreditCard },
  ],
  en: [
    { title: "Lesson records", body: "The date, duration and topic of every lesson", icon: BookOpenCheck },
    { title: "Lesson reports", body: "Teacher notes, homework and progress summaries", icon: FileText },
    { title: "Remaining lessons", body: "Your current package balance at a glance", icon: BarChart3 },
    { title: "Packages and payments", body: "Purchase packages and review payment history", icon: CreditCard },
  ],
} as const;

export function AuthExperience({ locale, children }: { locale: Locale; children: ReactNode }) {
  const contact = useSiteContact();
  const isTr = locale === "tr";

  return (
    <section className={styles.section}>
      <div className={styles.shell}>
        <aside className={styles.aside}>
          <div className={styles.rings} aria-hidden="true" />
          <p className={styles.eyebrow}>{isTr ? "VELİ HESABI" : "GUARDIAN ACCOUNT"}</p>
          <h2>{isTr ? <>Tüm ders süreciniz,<br />tek ekranda.</> : <>Your entire learning journey,<br />in one place.</>}</h2>
          <p className={styles.intro}>
            {isTr
              ? "Ders kayıtlarını, öğretmen raporlarını, kalan ders hakkınızı ve ödemelerinizi istediğiniz an hesabınızdan takip edin."
              : "Follow lesson records, teacher reports, remaining lesson rights and payments whenever you need."}
          </p>
          <ul className={styles.features}>
            {FEATURES[locale].map(({ title, body, icon: Icon }) => (
              <li key={title}>
                <span className={styles.featureIcon}><Icon size={18} aria-hidden="true" /></span>
                <span><strong>{title}</strong><small>{body}</small></span>
              </li>
            ))}
          </ul>
          <div className={styles.help}>
            <Headphones size={17} aria-hidden="true" />
            <span>{isTr ? "Giriş yapamıyor musunuz?" : "Having trouble signing in?"}</span>
            <a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer">
              {isTr ? "WhatsApp'tan yazın" : "Message us on WhatsApp"}
            </a>
          </div>
        </aside>
        <div className={styles.content}>{children}</div>
      </div>
    </section>
  );
}

export function AuthSecureNote({ locale }: { locale: Locale }) {
  return (
    <p className={styles.secureNote}>
      <ShieldCheck size={15} aria-hidden="true" />
      {locale === "tr" ? "256-bit SSL ile korunan bağlantı" : "Connection protected by 256-bit SSL"}
    </p>
  );
}

export { styles as authExperienceStyles };
