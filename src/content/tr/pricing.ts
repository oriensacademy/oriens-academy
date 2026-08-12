import type { PricingContent } from "../pricing";

export const pricing = {
  metadata: {
    title: "Ücretler | Oriens Academy",
    description: "Oriens Academy birebir ders, sınav hazırlığı ve kapsamlı akademik destek programları için başlangıç ücretlerini ve paket kapsamlarını inceleyin.",
  },
  breadcrumb: { ariaLabel: "Sayfa yolu", home: "Ana Sayfa", current: "Ücretler" },
  hero: {
    eyebrow: "Ücretler",
    title: "Akademik desteğin kapsamı kadar fiyatı da açık olmalı.",
    description: "Mevcut başlangıç ücretlerini ve doğrulanmış paket kapsamlarını yan yana görün. Öğrencinin gerçek ihtiyacına göre hazırlanan kesin teklif, ücretsiz ilk görüşmenin ardından paylaşılır.",
    primaryCta: "Paketleri İncele",
    secondaryCta: "Ücretsiz Görüşme Planla",
    indexLabel: "3 aktif destek rotası",
  },
  packages: {
    eyebrow: "Paketler",
    title: "Tek ders odağından kapsamlı akademik yolculuğa.",
    intro: "Paketler abonelik katmanları değil, farklı akademik destek kapsamlarıdır. Başlangıç değerleri mevcut Oriens proje içeriğinden alınmıştır.",
    featuredLabel: "En Çok Tercih Edilen",
    activeLabel: "Aktif paket",
    priceSourceNote: "Gösterilen tutarlar başlangıç değerleridir. Kesin kapsam ve teklif ilk değerlendirmeden sonra belirlenir.",
    customPrice: "Özel Teklif",
    billingLabels: { session: "/ seans", month: "/ ay", custom: "İhtiyaca göre" },
    formatStartingPrice: (amount) => `${amount}€'dan başlayan`,
    ctaLabel: "Bu Paketi Görüşelim",
    items: {
      foundation: {
        title: "Temel",
        description: "Tek bir derse odaklı hazırlık için.",
        features: ["Haftalık birebir dersler", "Kapsamlı değerlendirme", "İlerleme raporlaması"],
      },
      method: {
        title: "Metot",
        description: "Çok dersli, kapsamlı sınav hazırlık programı.",
        features: ["Temel pakette olan her şey", "Kapsamlı Oriens Metodu planlaması", "İki haftada bir deneme sınavı", "Eğitmene doğrudan erişim"],
      },
      immersive: {
        title: "Tam Kapsamlı",
        description: "Üniversite başvuru sürecinin sonuna kadar kapsamlı destek.",
        features: ["Metot paketinde olan her şey", "Üniversite başvuru danışmanlığı", "Mülakat hazırlığı", "Size özel süreç sorumlusu"],
      },
    },
  },
  included: {
    eyebrow: "Kapsamı anlamak",
    title: "Her pakette neyin yer aldığı görünür olmalı.",
    intro: "Aşağıdaki başlıklar mevcut proje içeriğinde yer alan destek unsurlarını açıklar; her unsur her pakete otomatik olarak dâhil değildir.",
    items: [
      { title: "Birebir akademik çalışma", description: "Temel paket haftalık birebir dersleri; diğer paketler ise genişleyen program kapsamını temel alır." },
      { title: "Değerlendirme ve planlama", description: "Program, kapsamlı bir değerlendirme ve öğrencinin ihtiyacına göre oluşturulan çalışma rotasıyla başlar." },
      { title: "İlerleme takibi", description: "Temel pakette ilerleme raporlaması; Metot paketinde planlama ve düzenli deneme çalışmaları açıkça tanımlanmıştır." },
      { title: "Başvuru desteği", description: "Üniversite başvuru ve mülakat hazırlığı yalnızca Tam Kapsamlı paket içinde belirtilmiştir." },
    ],
  },
  explanation: {
    eyebrow: "Şeffaf süreç",
    title: "Doğru paket, kısa bir değerlendirmeden sonra netleşir.",
    intro: "Paket seçimi yalnızca ders sayısına değil, hedefe, mevcut seviyeye ve gerekli destek kapsamına dayanır.",
    steps: [
      { id: "conversation", title: "Ücretsiz ilk görüşme", description: "Öğrencinin hedefi, mevcut durumu ve ihtiyaç duyduğu destek alanı konuşulur." },
      { id: "assessment", title: "Kapsamı belirleme", description: "Tek ders, çok dersli hazırlık veya başvuru desteği ihtiyacı ayrıştırılır." },
      { id: "proposal", title: "Net teklif", description: "Uygun paket, çalışma düzeni ve kesin ücret görüşmenin ardından paylaşılır." },
    ],
  },
  faq: {
    eyebrow: "Sık sorulan sorular",
    title: "Ücretlendirme hakkında.",
    items: [
      { question: "Gösterilen ücretler kesin fiyat mı?", answer: "€90/seans ve €320/ay değerleri mevcut Oriens içeriğinde başlangıç ücretleri olarak tanımlanmıştır. Kesin teklif öğrencinin ihtiyaçları değerlendirildikten sonra paylaşılır." },
      { question: "Hangi paketi seçmem gerektiğini nasıl belirlerim?", answer: "Tek ders odağı, çok dersli sınav hazırlığı ve üniversite başvuru desteği farklı kapsamlar gerektirir. İlk görüşme, uygun kapsamı birlikte belirlemek içindir." },
      { question: "Tam Kapsamlı paketin neden sabit fiyatı yok?", answer: "Mevcut proje içeriği bu paketi özel teklif olarak tanımlar. Başvuru danışmanlığı, mülakat hazırlığı ve süreç sorumlusu gibi kapsamlar öğrencinin ihtiyacına göre değerlendirilir." },
      { question: "İlk görüşme ücretli mi?", answer: "Hayır. Mevcut Oriens içeriğinde ilk 30 dakikalık görüşme ücretsiz ve taahhütsüz olarak belirtilmiştir." },
    ],
  },
  cta: {
    eyebrow: "Karar vermeden önce konuşalım",
    title: "Hangi paketin size uygun olduğundan emin değil misiniz?",
    body: "Hedefinizi ve ihtiyaç duyduğunuz akademik desteği konuşarak doğru kapsamı birlikte belirleyebiliriz.",
    primary: "Ücretsiz Görüşme Planla",
    secondary: "İletişime Geç",
  },
} satisfies PricingContent;
