"use client";

import { useLocale } from "@/content/locale-context";

const copy = {
  tr: {
    privacy: { title: "Gizlilik Politikası", intro: "Bu politika, Oriens Academy web sitesi ve iletişim hizmetleri kapsamında işlenen verileri açıklar.", sections: [
      ["Toplanan bilgiler", "İletişim ve görüşme formlarında paylaştığınız ad, e-posta, telefon, mesaj ve akademik ihtiyaç bilgileri işlenebilir. Güvenlik ve hizmet sürekliliği için sınırlı teknik günlük verileri de tutulabilir."],
      ["İşleme amacı", "Veriler; talebinizi yanıtlamak, görüşme planlamak, eğitim ve danışmanlık hizmeti sunmak, güvenliği sağlamak ve hizmet kalitesini geliştirmek için kullanılır."],
      ["İletişim ve hizmet sunumu", "Talebinizle ilgili e-posta veya verdiğiniz diğer iletişim kanalları üzerinden sizinle iletişim kurulabilir."],
      ["Saklama ve güvenlik", "Veriler yalnızca hizmet, güvenlik ve geçerli yükümlülükler için gerekli süre boyunca saklanır. Yetkisiz erişimi azaltmak amacıyla uygun teknik ve organizasyonel önlemler uygulanır."],
      ["Üçüncü taraf altyapısı", "Barındırma, veritabanı, e-posta ve güvenlik hizmetleri için güvenilir altyapı sağlayıcıları kullanılabilir. Veriler yalnızca hizmetin gerektirdiği ölçüde paylaşılır."],
      ["Talepleriniz", "Verilerinizle ilgili erişim, düzeltme veya silme talebinizi oriensacademy@gmail.com adresine iletebilirsiniz."],
    ]},
    terms: { title: "Kullanım Koşulları", intro: "Bu koşullar Oriens Academy web sitesi ile eğitim ve danışmanlık hizmetlerinin genel kullanım çerçevesini açıklar.", sections: [
      ["Hizmet kapsamı", "Oriens Academy sınav hazırlığı, akademik destek ve eğitim danışmanlığı sunar. Web sitesi içerikleri genel bilgilendirme niteliğindedir ve belirli bir kabul veya sonuç garantisi oluşturmaz."],
      ["Planlama ve randevular", "Görüşme ve ders saatleri karşılıklı uygunluğa göre kesinleşir. Değişiklik veya iptal talepleri mümkün olduğunca erken iletilmelidir."],
      ["Ödemeler ve paketler", "Güncel fiyat, paket kapsamı, ödeme ve varsa iptal koşulları satın alma veya hizmet onayı öncesinde kullanıcıya bildirilir."],
      ["Fikri mülkiyet ve kabul edilebilir kullanım", "Site içeriği ve eğitim materyalleri izin olmadan çoğaltılamaz veya ticari amaçla kullanılamaz. Siteye zarar veren, yanıltıcı veya hukuka aykırı kullanıma izin verilmez."],
      ["Sorumluluğun sınırı", "Hizmetler akademik gelişimi desteklemek üzere sunulur; sınav, kabul veya kariyer sonuçları öğrencinin çalışması ve üçüncü taraf kararları dahil birçok etkene bağlıdır."],
      ["Değişiklikler ve iletişim", "Hizmetler veya bu koşullar gerektiğinde güncellenebilir. Sorular için oriensacademy@gmail.com adresinden iletişime geçebilirsiniz."],
    ]},
  },
  en: {
    privacy: { title: "Privacy Policy", intro: "This policy explains how data is handled through the Oriens Academy website and contact services.", sections: [
      ["Information we collect", "We may process your name, email, phone number, message and academic needs submitted through contact and consultation forms. Limited technical log data may also be retained for security and service continuity."],
      ["Purpose of processing", "Data is used to answer requests, schedule consultations, deliver education and consultancy services, protect the service and improve quality."],
      ["Communication and service delivery", "We may contact you about your request by email or through another contact method you provide."],
      ["Retention and security", "Data is retained only as long as needed for service, security and applicable obligations. Appropriate technical and organisational safeguards are used to reduce unauthorised access."],
      ["Third-party infrastructure", "Trusted hosting, database, email and security providers may process data only to the extent required to deliver the service."],
      ["Your requests", "You may request access, correction or deletion of your data by contacting oriensacademy@gmail.com."],
    ]},
    terms: { title: "Terms of Service", intro: "These terms provide the general framework for using the Oriens Academy website, education and consultancy services.", sections: [
      ["Service scope", "Oriens Academy provides exam preparation, academic support and education consultancy. Website content is informational and does not guarantee a particular admission or result."],
      ["Scheduling", "Consultations and lesson times are confirmed according to mutual availability. Changes or cancellations should be communicated as early as possible."],
      ["Payments and packages", "Current pricing, package scope, payment terms and applicable cancellation conditions are communicated before purchase or service confirmation."],
      ["Intellectual property and acceptable use", "Website content and educational materials may not be reproduced or used commercially without permission. Harmful, misleading or unlawful use is prohibited."],
      ["Limitation of liability", "Services support academic development; exam, admission and career results depend on many factors including student work and third-party decisions."],
      ["Changes and contact", "Services or these terms may be updated when needed. Contact oriensacademy@gmail.com with questions."],
    ]},
  },
} as const;

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const locale = useLocale();
  const page = copy[locale][kind];
  return <section className="pt-28 pb-20 md:pt-36 md:pb-28"><div className="mx-auto max-w-[900px] px-6 md:px-12"><p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-accent">Oriens Academy</p><h1 className="mt-4 font-heading text-[clamp(2.8rem,7vw,5rem)] font-normal leading-[1.02] tracking-[-0.025em] text-ink">{page.title}</h1><p className="mt-6 max-w-[68ch] text-lg leading-relaxed text-ink/70">{page.intro}</p><div className="mt-12 divide-y divide-border border-y border-border">{page.sections.map(([title, body]) => <section key={title} className="py-7"><h2 className="font-heading text-2xl text-ink">{title}</h2><p className="mt-3 max-w-[72ch] text-base leading-[1.75] text-ink/72">{body}</p></section>)}</div></div></section>;
}
