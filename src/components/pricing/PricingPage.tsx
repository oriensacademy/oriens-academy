"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, CreditCard, MessageCircle, Scale, ShieldAlert, ShieldCheck, UsersRound } from "lucide-react";
import { AccountWaveLoader } from "@/components/auth/AccountWaveLoader";
import { ButtonLink } from "@/components/ui/button";
import { useLocale } from "@/content/locale-context";
import { getPublicPricingPackages, type PublicPricingPackage } from "@/lib/admin/pricing";
import { useSiteContact } from "@/lib/contact-settings";
import { getLocalizedPackageDisplayPrice } from "@/lib/pricing/package-display";
import { localizedPath } from "@/lib/routes";
import { usePublicSettings } from "@/lib/settings/public-settings-context";
import styles from "./pricing-page.module.css";

const STANDARD_PACKAGE_IDS = ["single", "package5", "package10", "package20", "package30"] as const;

type Copy = {
  heroStart: string; heroEmphasis: string; heroEnd: string; heroLead: string;
  transparentPricing: string; fixedPrice: string; packagesLabel: string; lesson: string;
  perLesson: string; unbundled: string; noDiscount: string; savings: (amount: string) => string;
  buy: string; taxNote: string; includedEyebrow: string; includedTitle: string;
  faqEyebrow: string; faqTitle: string; faqIntro: string; helpTitle: string; helpBody: string;
  write: string; loading: string; unavailable: string; updateTitle: string; updateBody: string;
};

const COPY: Record<"tr" | "en", Copy> = {
  tr: {
    heroStart: "Hedefinize uygun ", heroEmphasis: "çalışma planını", heroEnd: " seçin.",
    heroLead: "Birebir derslerle sınav sürecinizi düzenli ve güvenle yönetin.",
    transparentPricing: "Şeffaf fiyatlandırma", fixedPrice: "Haziran 2027'ye kadar sabit fiyat",
    packagesLabel: "Ders paketleri", lesson: "ders", perLesson: "Ders başı", unbundled: "Paketsiz",
    noDiscount: "İndirim yok", savings: (amount) => `${amount} tasarruf`, buy: "Satın Al",
    taxNote: "Tüm ödeme süreci vergi mevzuatına uygundur.", includedEyebrow: "Tüm paketlerde",
    includedTitle: "Her pakette aynı standartlar.", faqEyebrow: "Sık sorulan sorular",
    faqTitle: "Ücretler ve paketler hakkında", faqIntro: "Aklınıza takılan bir şey mi var? En sık sorulanları burada topladık.",
    helpTitle: "Başka bir sorunuz mu var?", helpBody: "WhatsApp'tan yazın, hemen yanıtlayalım.", write: "Yazın",
    loading: "Paketler yükleniyor", unavailable: "Aktif ders paketleri şu anda görüntülenemiyor. Görüşme formundan bize ulaşabilirsiniz.",
    updateTitle: "Paket ve Fiyat Bilgileri Güncelleniyor",
    updateBody: "Eğitim paketlerimizin içerik ve ücret yapıları şu anda güncellenmektedir. Detaylı bilgi için ücretsiz tanışma görüşmesi planlayabilirsiniz.",
  },
  en: {
    heroStart: "Choose the ", heroEmphasis: "study plan", heroEnd: " that fits your goals.",
    heroLead: "Manage your exam preparation confidently with one-to-one lessons.",
    transparentPricing: "Transparent pricing", fixedPrice: "Fixed prices until June 2027",
    packagesLabel: "Lesson packages", lesson: "lessons", perLesson: "Per lesson", unbundled: "Single lesson",
    noDiscount: "No discount", savings: (amount) => `Save ${amount}`, buy: "Purchase",
    taxNote: "The entire payment process complies with applicable tax regulations.", includedEyebrow: "Included in every package",
    includedTitle: "The same standards in every package.", faqEyebrow: "Frequently asked questions",
    faqTitle: "About fees and packages", faqIntro: "Have a question? We have gathered the most common answers here.",
    helpTitle: "Still have a question?", helpBody: "Message us on WhatsApp and we will be happy to help.", write: "Message us",
    loading: "Loading packages", unavailable: "Active lesson packages are currently unavailable. You can contact us through the consultation form.",
    updateTitle: "Package and Fee Information Is Being Updated",
    updateBody: "Our lesson packages and fees are currently being updated. You can book a complimentary consultation for details.",
  },
};

const BENEFITS = {
  tr: [
    { icon: Clock3, value: "60", suffix: "dk", title: "Her ders 60 dakika", body: "Tüm dersler birebir ve 60 dakika olarak işlenir." },
    { icon: CreditCard, value: "%25", suffix: "'e kadar", title: "Ön ödemeli indirim", body: "İndirimli paket ücretleri ön ödemelidir." },
    { icon: ShieldCheck, value: "2027", suffix: "", title: "Fiyat garantisi", body: "Ders ücretleri Haziran 2027'ye kadar sabittir." },
    { icon: UsersRound, value: "1:1", suffix: "", title: "Birebir destek", body: "Esnek planlama ve kişiye özel ders akışı." },
  ],
  en: [
    { icon: Clock3, value: "60", suffix: "min", title: "60-minute lessons", body: "Every lesson is one-to-one and lasts 60 minutes." },
    { icon: CreditCard, value: "25%", suffix: "off", title: "Prepaid discount", body: "Discounted package fees are prepaid." },
    { icon: ShieldCheck, value: "2027", suffix: "", title: "Price guarantee", body: "Lesson fees are fixed until June 2027." },
    { icon: UsersRound, value: "1:1", suffix: "", title: "Personal support", body: "Flexible scheduling and a tailored lesson plan." },
  ],
} as const;

const FAQ = {
  tr: [
    { icon: Clock3, question: "Dersler kaç dakika sürüyor?", answer: "Tüm dersler birebir ve 60 dakikadır." },
    { icon: CalendarDays, question: "Fiyatlar ne zamana kadar geçerli?", answer: "Ders ücretleri Haziran 2027 tarihine kadar sabittir." },
    { icon: CreditCard, question: "Paket ödemeleri nasıl yapılır?", answer: "İndirimli paket ücretleri ön ödemelidir. Ödeme, sitedeki güvenli ödeme sayfasından kartla ve 3D Secure doğrulamasıyla yapılır; tüm süreç vergi mevzuatına uygundur." },
    { icon: MessageCircle, question: "Tanışma görüşmesi ücretli mi?", answer: "Hayır. İlk tanışma görüşmesi ücretsizdir; hedeflerinizi ve size uygun paketi birlikte belirleriz." },
    { icon: Scale, question: "Her öğrenci için aynı ücret mi uygulanıyor?", answer: "Evet. Fiyatlandırmamız şeffaftır; tüm öğrenciler için aynı standart ücretler geçerlidir." },
  ],
  en: [
    { icon: Clock3, question: "How long is each lesson?", answer: "Every lesson is one-to-one and lasts 60 minutes." },
    { icon: CalendarDays, question: "How long are these fees valid?", answer: "Lesson fees are fixed until June 2027." },
    { icon: CreditCard, question: "How are package payments made?", answer: "Discounted package fees are prepaid. Card payments use our secure checkout with 3D Secure verification, and the process complies with applicable tax regulations." },
    { icon: MessageCircle, question: "Is the introductory call free?", answer: "Yes. The first consultation is free; together we identify your goals and the package that suits you." },
    { icon: Scale, question: "Does every student pay the same fee?", answer: "Yes. Our pricing is transparent and the same standard fees apply to every student." },
  ],
} as const;

function numeric(value: number | string | null | undefined) {
  const parsed = value == null ? null : Number(value);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function money(amount: number, locale: "tr" | "en", currency: "TRY" | "EUR") {
  const hasDecimals = Math.abs(amount - Math.round(amount)) > 0.005;
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0, maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(amount);
  return `${formatted} ${currency === "TRY" ? (locale === "tr" ? "TL" : "TRY") : "EUR"}`;
}

function splitMoney(amount: number, locale: "tr" | "en", currency: "TRY" | "EUR") {
  const formatted = money(amount, locale, currency);
  const separator = formatted.lastIndexOf(" ");
  return { amount: formatted.slice(0, separator), currency: formatted.slice(separator + 1) };
}

function referenceBadgeLabel(value: string | null | undefined, locale: "tr" | "en") {
  const badge = value?.trim();
  if (!badge) return null;
  if (locale === "tr") {
    const normalized = badge.toLocaleLowerCase("tr-TR");
    if (normalized === "en çok tercih edilen") return "En popüler";
    if (normalized === "en avantajlı paket") return "En avantajlı";
  }
  return badge;
}

function PackageRow({ item, locale, copy }: { item: PublicPricingPackage; locale: "tr" | "en"; copy: Copy }) {
  const lessons = numeric(item.lesson_count) ?? 1;
  const display = getLocalizedPackageDisplayPrice({ locale, tryAmount: item.current_total ?? item.price_amount, eurAmount: item.price_eur });
  const current = display.amount ?? 0;
  const discount = numeric(item.discount_percentage);
  const trOld = numeric(item.old_total);
  const old = locale === "tr" || display.usesTryFallback
    ? trOld
    : discount && discount > 0 && discount < 100 ? current / (1 - discount / 100) : null;
  const trUnit = numeric(item.unit_price);
  const unit = locale === "tr" || display.usesTryFallback ? trUnit ?? current / lessons : current / lessons;
  const savings = old !== null && old > current ? old - current : null;
  const badge = referenceBadgeLabel(locale === "tr" ? item.badge_tr : item.badge_en, locale);
  const name = (locale === "tr" ? item.name_tr : item.name_en)?.trim() || item.id;
  const description = (locale === "tr" ? item.description_tr : item.description_en)?.trim() || "";
  const total = splitMoney(current, locale, display.currency);

  return (
    <li
      className={styles.packageRow}
      data-package-id={item.id}
      data-lesson-count={lessons}
      data-current-price={money(current, locale, display.currency)}
      data-unit-price={money(unit, locale, display.currency)}
    >
      {badge ? <span className={`${styles.badge} ${item.id === "package30" ? styles.badgeAlt : ""}`} data-pricing-badge>{badge}</span> : null}
      <span className={styles.lessonCount}><b>{lessons}</b><small>{copy.lesson}</small></span>
      <span className={styles.packageMeta}><span className={styles.packageTitle}>{name}</span><span className={styles.packageDescription}>{description}</span></span>
      <span className={styles.unitPrice}><small>{copy.perLesson}</small><b>{money(unit, locale, display.currency)}</b></span>
      <span className={styles.priceBlock}>
        <span className={styles.oldPrice}>{old !== null ? <><s>{money(old, locale, display.currency)}</s>{discount ? <em>%{discount}</em> : null}</> : <span>{copy.unbundled}</span>}</span>
        <span className={styles.currentPrice}>{total.amount}<small>{total.currency}</small></span>
        <span className={styles.mobileUnit}>{copy.perLesson} <b>{money(unit, locale, display.currency)}</b></span>
        <span className={`${styles.savings} ${savings === null ? styles.savingsMuted : ""}`}>{savings !== null ? copy.savings(money(savings, locale, display.currency)) : copy.noDiscount}</span>
      </span>
      <span className={styles.actions}>
        <Link className={styles.buyButton} href={`${localizedPath("payment", locale)}?package=${encodeURIComponent(item.id)}`} data-pricing-action="purchase">
          {copy.buy}<ArrowRight aria-hidden="true" size={15} strokeWidth={2.4} />
        </Link>
      </span>
    </li>
  );
}

function RoundIcon({ icon: Icon }: { icon: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }> }) {
  return <span className={styles.roundIcon} aria-hidden="true"><Icon size={24} strokeWidth={1.7} /></span>;
}

export function PricingPage() {
  const locale = useLocale();
  const copy = COPY[locale];
  const contact = useSiteContact();
  const { showPricing, loading: settingsLoading } = usePublicSettings();
  const [dbPackages, setDbPackages] = useState<PublicPricingPackage[]>([]);
  const [pricingLoaded, setPricingLoaded] = useState(false);

  useEffect(() => {
    getPublicPricingPackages().then(setDbPackages).finally(() => setPricingLoaded(true));
  }, []);

  const activePackages = STANDARD_PACKAGE_IDS
    .map((id) => dbPackages.find((item) => item.id === id && item.active))
    .filter((item): item is PublicPricingPackage => Boolean(item));

  if (settingsLoading) return <AccountWaveLoader />;
  if (!showPricing) {
    return <section className={styles.unavailable}><ShieldAlert aria-hidden="true" size={36} /><h1>{copy.updateTitle}</h1><p>{copy.updateBody}</p><ButtonLink href={localizedPath("booking", locale)} size="lg">{locale === "tr" ? "Ücretsiz Görüşme Planla" : "Book a Free Consultation"}<ArrowRight className="size-4" /></ButtonLink></section>;
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1>{copy.heroStart}<em>{copy.heroEmphasis}</em>{copy.heroEnd}</h1>
        <p>{copy.heroLead}</p>
        <ul className={styles.chips}><li><Scale aria-hidden="true" size={16} />{copy.transparentPricing}</li><li><ShieldCheck aria-hidden="true" size={16} />{copy.fixedPrice}</li></ul>
      </section>
      <section className={styles.packages} aria-label={copy.packagesLabel}>
        {!pricingLoaded ? <div className={styles.packageList} aria-label={copy.loading}>{STANDARD_PACKAGE_IDS.map((id) => <div key={id} className={styles.skeleton} />)}</div>
          : activePackages.length ? <ul className={styles.packageList}>{activePackages.map((item) => <PackageRow key={item.id} item={item} locale={locale} copy={copy} />)}</ul>
          : <p className={styles.empty} role="status">{copy.unavailable}</p>}
        <p className={styles.taxNote}>{copy.taxNote}</p>
      </section>
      <section className={styles.benefitsSection} data-pricing-benefits>
        <div className={styles.benefitsBand}>
          <div className={styles.benefitsHead}><p>{copy.includedEyebrow}</p><h2>{copy.includedTitle}</h2></div>
          <ul className={styles.benefits}>{BENEFITS[locale].map((benefit) => <li key={benefit.title}><RoundIcon icon={benefit.icon} /><p className={styles.benefitValue}>{benefit.value}{benefit.suffix ? <small>{benefit.suffix}</small> : null}</p><p className={styles.benefitTitle}>{benefit.title}</p><p className={styles.benefitBody}>{benefit.body}</p></li>)}</ul>
        </div>
      </section>
      <section className={styles.faqSection}>
        <div className={styles.faqLayout}>
          <div className={styles.faqSide}>
            <p className={styles.eyebrow}>{copy.faqEyebrow}</p><h2>{copy.faqTitle}</h2><p className={styles.faqIntro}>{copy.faqIntro}</p>
            <div className={styles.helpCard}><span className={styles.helpIcon} aria-hidden="true"><MessageCircle size={22} strokeWidth={1.7} /></span><div><p>{copy.helpTitle}</p><small>{copy.helpBody}</small></div><a href={contact.whatsappHref} target="_blank" rel="noopener noreferrer">{copy.write}<span aria-hidden="true">→</span></a></div>
          </div>
          <div className={styles.faqList}>{FAQ[locale].map((item, index) => <details className={styles.faqItem} key={item.question} open={index === 0}><summary><RoundIcon icon={item.icon} /><span className={styles.question}>{item.question}</span><span className={styles.plus} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
        </div>
      </section>
    </div>
  );
}
