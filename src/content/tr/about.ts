import type { AboutContent } from "../about";

export const about: AboutContent = {
  metadata: {
    title: "Hakkımızda | Oriens Academy",
    description: "Oriens Academy kurucusu Tutor Doğuhan ile tanışın. IB, AP, SAT, ESAT, TARA, TMUA, IGCSE sınavlarında ezber değil, sınavın mantığını çözen yaklaşım.",
  },
  breadcrumb: { ariaLabel: "Sayfa yolu", home: "Ana Sayfa", current: "Hakkımızda" },
  hero: {
    eyebrow: "Hakkımızda",
    title: "Kurucumuzla tanışın.",
    description: "Matematik-Fizik eğitmeni. 10 yılı aşkın süredir IB, AP, SAT, ESAT, TARA, TMUA ve IGCSE öğrencileriyle birebir çalışıyor; aralarında Robert Kolej, St. Joseph, Liceo Italiano ve Üsküdar Amerikan gibi yabancı müfredat okullarının öğrencileri de var. Yaklaşım; ezber değil, sınavın mantığını çözmek üzerine kurulu.",
    primaryCta: "Ücretsiz Tanışma Görüşmesi",
    secondaryCta: "Sınavları İncele",
    visualLabel: "Tutor Doğuhan — Matematik-Fizik Eğitmeni",
    visualSteps: ["Robert Kolej", "St. Joseph", "Liceo Italiano", "Üsküdar Amerikan"],
  },
  story: {
    eyebrow: "Yaklaşımımız",
    title: "Ezber değil, sınavın mantığını çözmek üzerine kurulu bir çalışma sistemi.",
    paragraphs: [
      "10 yılı aşkın süredir uluslararası müfredatlarda eğitim gören öğrencilerle birebir çalışıyoruz. Robert Kolej, St. Joseph, Liceo Italiano ve Üsküdar Amerikan Lisesi gibi köklü okulların öğrencilerinin akademik hedeflerine ulaşmalarına destek veriyoruz.",
      "Her sınavın kendi dili, puanlama mantığı ve zaman baskısı olduğu için hazırlık sürecini doğrudan o sınava özel kurguluyoruz.",
    ],
    note: "Doğuhan — Matematik-Fizik Eğitmeni & Oriens Academy Kurucusu",
  },
  principles: {
    eyebrow: "İlkeler",
    title: "Başarıyı getiren temel prensiplerimiz.",
    intro: "Her ders ve hazırlık süreci bu beş temel ilkeye dayanır.",
    items: [
      { id: "direction", title: "Sınavın Mantığı", description: "Ezbere değil, sorunun arkasındaki mantığı anlamaya odaklanıyoruz." },
      { id: "individualisation", title: "Birebir Çalışma", description: "Öğrencinin seviyesine, hızına ve eksiklerine özel kurgulanan ders akışı." },
      { id: "clarity", title: "Ölçülebilir İlerleme", description: "Düzenli zamanlı deneme sınavları ve net durum analizleri." },
      { id: "review", title: "Zaman Yönetimi", description: "Sınav anındaki zaman baskısını yönetme teknikleri ve stratejileri." },
      { id: "integrity", title: "Akademik Güven", description: "10+ yıllık deneyim ile üniversiteye giden yolda sağlam bir rehberlik." },
    ],
  },
  team: {
    eyebrow: "Eğitmen",
    title: "Kurucu Eğitmen",
    intro: "10+ yıl deneyimli Matematik-Fizik eğitmeni.",
    members: [
      {
        id: "doguhan",
        name: "Doğuhan",
        role: "Matematik-Fizik Eğitmeni / Kurucu",
        bio: "10 yılı aşkın süredir IB, AP, SAT, ESAT, TARA, TMUA, IGCSE ve üniversite matematik-fizik derslerinde birebir destek veriyor.",
        credentials: ["Robert Kolej", "St. Joseph", "Liceo Italiano", "Üsküdar Amerikan"],
      },
    ],
    fallbackTitle: "Birebir Eğitmen Desteği",
    fallbackBody: "Tüm dersler doğrudan kurucu eğitmenimiz Doğuhan rehberliğinde yürütülmektedir.",
    fallbackPoints: ["10+ Yıl Deneyim", "Robert Kolej & Hedef Okullar", "Birebir Ders Kurgusu"],
  },
  brandMoment: {
    eyebrow: "Oriens Academy",
    title: "Rotanı birlikte çizelim.",
    body: "Hedefinizdeki üniversite ve sınava yönelik en doğru çalışma rotasını oluşturuyoruz.",
    steps: ["Analiz", "Strateji", "Pratik", "Başarı"],
  },
  outcomes: {
    eyebrow: "Okullarımız",
    title: "Birlikte çalıştığımız öğrenci grupları.",
    intro: "Türkiye'nin önde gelen uluslararası müfredat okullarından öğrencilerle düzenli olarak çalışıyoruz.",
    metrics: [],
    items: [
      { title: "Robert Kolej", description: "IB ve AP sınavlarında hedefli ders desteği." },
      { title: "St. Joseph", description: "Fransız/uluslararası müfredat matematik ve fizik desteği." },
      { title: "Liceo Italiano", description: "İtalyan Lisesi ve IMAT / uluslararası sınav hazırlığı." },
      { title: "Üsküdar Amerikan Lisesi", description: "IB HL/SL derslerinde ve SAT süreçlerinde birebir takviye." },
    ],
    disclaimer: "Tüm okul isimleri öğrencilerimizin eğitim gördüğü kurumları ifade etmektedir.",
  },
  trust: {
    eyebrow: "İletişim Kanalları",
    title: "Bize ulaşın.",
    intro: "Sorularınız ve randevu talepleriniz için doğrudan iletişim kanallarımız:",
    examLabel: "İletişim",
    links: [
      { route: "contact", title: "WhatsApp", description: "+90 544 293 90 40 üzerinden anında mesaj gönderin.", linkLabel: "WhatsApp'tan Yazın" },
      { route: "contact", title: "E-Posta", description: "oriensacademy@gmail.com adresinden detaylı bilgi alın.", linkLabel: "E-Posta Gönderin" },
      { route: "contact", title: "Instagram", description: "@oriens.academy hesabımızı takip edin.", linkLabel: "Instagram'da Görün" },
    ],
  },
  testimonials: {
    eyebrow: "Öğrenciler Ne Diyor",
    title: "111'den fazla değerlendirmeden bir kaçı.",
    items: [
      {
        id: "1",
        quote: "Oğlumun IB Fizik notu belirgin şekilde yükseldi, derse artık severek katılıyor.",
        author: "Ahu G.",
        role: "Veli · IB Fizik",
      },
      {
        id: "2",
        quote: "Oğlumun IB HL Matematik ve Fizik'te motivasyonu ve özgüveni belirgin biçimde arttı.",
        author: "Yasemin T.",
        role: "Veli · IB HL Matematik & Fizik",
      },
      {
        id: "3",
        quote: "Karmaşık konuları basit anlatımıyla öğretti; tüm matematik ve fizik sınavlarımı yüksek notla geçtim.",
        author: "Ahmet S.",
        role: "Öğrenci · Üniversite Fizik",
      },
      {
        id: "4",
        quote: "Kısa sürede belirgin bir başarı sağladı, oldukça yetkin bir eğitimci.",
        author: "Ece A.",
        role: "Öğrenci · AYT Sınav Hazırlık",
      },
      {
        id: "5",
        quote: "Geometriye karşı çekingenliğimi kısa sürede aştırdı, konuları sevdirerek ve pratik ipuçlarıyla öğretti.",
        author: "Ada Elif A.",
        role: "Öğrenci · Lise Matematik & Fizik",
      },
      {
        id: "6",
        quote: "Kızımızın eksiklerini hızla tespit edip yazılı sınavına başarıyla hazırladı.",
        author: "Bülent I.",
        role: "Veli",
      },
    ],
  },
  cta: {
    eyebrow: "Tanışma Görüşmesi",
    title: "Başlamaya hazır mısınız?",
    body: "Formu doldurun veya bizimle iletişime geçin. İlk görüşme ücretsizdir.",
    primary: "Ücretsiz Tanışma Görüşmesi",
    secondary: "İletişime Geç",
  },
};
