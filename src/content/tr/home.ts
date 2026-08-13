import { Fingerprint, Globe2, Target, Users, type LucideIcon } from "lucide-react";

/** Turkish — homepage-specific copy. */

export const hero = {
  eyebrow: "Uluslararası Sınav Hazırlık & Üniversite Ders Desteği",
  headline: "Dünyanın en iyi üniversitelerine giden rotanı birlikte çizelim.",
  body: "IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT ve OMPT sınavlarına; sınavın mantığını çözen, hedef odaklı ve ölçülebilir bir hazırlık süreci sunuyoruz.",
  ctaPrimary: "Ücretsiz Tanışma Görüşmesi",
  ctaSecondary: "Sınavları İncele",
};

export const trustResults = {
  eyebrow: "Akademik hedefe göre yapılandırılmış destek",
  items: [
    { title: "Uluslararası sınav hazırlığı", description: "12 sınav için sınava özel hazırlık kurgusu ve birebir antrenman." },
    { title: "Üniversite ders desteği", description: "Calculus, Lineer Cebir, Diferansiyel Denklemler, İstatistik ve Fizik I-II takviyesi." },
    { title: "Türkçe ve İngilizce", description: "İki dilde erişilebilen akademik içerik ve ders akışı." },
    { title: "Şeffaf ücretlendirme", description: "Haziran 2027'ye kadar sabit paket ücretleri ve ücretsiz tanışma görüşmesi." },
  ],
};

export const examPreparation = {
  eyebrow: "Sınav Hazırlığı",
  headline: "On iki sınav. Hedef odaklı hazırlık.",
  body: "Her sınavın kendi dili, puanlama mantığı ve zaman baskısı olduğu için hazırlık o sınava özel kurgulanır.",
  categories: [
    {
      label: "Uluslararası Sınavlar",
      exams: ["IB", "AP", "SAT", "ESAT", "TARA", "TMUA"],
    },
    {
      label: "Kabul ve Yerleştirme Sınavları",
      exams: ["IGCSE", "GRE", "GMAT", "UKCAT", "IMAT", "OMPT"],
    },
  ],
};

export const oriensMethod = {
  eyebrow: "Yaklaşımımız",
  headline: "Ezber değil, sınavın mantığını çözmek.",
  stages: [
    {
      n: "01",
      name: "Anla",
      copy: "Öğrencinin hedefini, mevcut seviyesini ve eksiklerini netleştiriyoruz.",
    },
    {
      n: "02",
      name: "Planla",
      copy: "Sınavın diline ve formatına uygun birebir çalışma rotası oluşturuyoruz.",
    },
    {
      n: "03",
      name: "Hazırlan",
      copy: "Konu bazlı derinleşme ve sınava özel pratik teknikleri uyguluyoruz.",
    },
    {
      n: "04",
      name: "Ölç",
      copy: "Düzenli zamanlı deneme sınavları ile tempo ve zaman yönetimi kazanıyoruz.",
    },
    {
      n: "05",
      name: "İyileştir",
      copy: "Deneme sonuçlarına göre eksikleri hızla kapatıyoruz.",
    },
    {
      n: "06",
      name: "Başar",
      copy: "Sınav gününde yüksek performans ve hedeflenen puan artışı.",
    },
  ],
};

export const signatureMathematics = {
  eyebrow: "Matematik & Fizik Odağı",
  headline: "Sınav mantığını kavrayan hassas problem çözme.",
  body: "Karmaşık sayısal ve mantıksal problemleri basit anlatımla çözülebilir hâle getiriyoruz.",
  sliderLabel: "Eğri üzerindeki konum",
  readout: { point: "Nokta", value: "Değer", slope: "Eğim" },
};

export const universitySupport = {
  eyebrow: "Üniversite Ders Desteği",
  headline: "Sınav hazırlığıyla sınırlı değiliz.",
  areas: [
    {
      n: "I",
      title: "Calculus & Lineer Cebir",
      copy: "Üniversite düzeyinde temel matematik derslerinde dönem boyu birebir destek.",
    },
    {
      n: "II",
      title: "Fizik I & Fizik II",
      copy: "Mühendislik ve fen fakültesi fizik derslerinde ödev ve sınav hazırlığı.",
    },
    {
      n: "III",
      title: "Diferansiyel Denklemler & İstatistik",
      copy: "Konu mantığını kavratan ve final sınavlarına hazırlayan çalışma düzeni.",
    },
    {
      n: "IV",
      title: "Ödev ve Vize/Final Takviyesi",
      copy: "Dönem içi ders performansını ve sınav notlarını yükselten düzenli antrenman.",
    },
  ],
  visualCaption: "Calculus, Lineer Cebir, Fizik I-II ders desteği.",
};

export const whyOriens = {
  eyebrow: "Neden Oriens?",
  headline: "Bizi farklı kılan temel özellikler.",
  reasons: [
    {
      icon: Fingerprint as LucideIcon,
      title: "10+ Yıl Deneyim",
      copy: "Robert Kolej, St. Joseph, Liceo Italiano ve Üsküdar Amerikan öğrencileriyle 10 yılı aşkın birebir deneyim.",
    },
    {
      icon: Target as LucideIcon,
      title: "Ezber Değil Mantık",
      copy: "Sınavın kendi dilini, puanlama mantığını ve soru yapısını öğreten yaklaşım.",
    },
    {
      icon: Globe2 as LucideIcon,
      title: "12 Uluslararası Sınav",
      copy: "IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT, OMPT uzmanlığı.",
    },
    {
      icon: Users as LucideIcon,
      title: "Birebir Akademik Destek",
      copy: "Öğrencinin hedefine ve zaman takvimine göre özelleştirilen ders akışı.",
    },
  ],
};

export const instructorAbout = {
  eyebrow: "Eğitmenimiz",
  name: "Doğuhan — Matematik & Fizik Eğitmeni",
  body: "10 yılı aşkın süredir IB, AP, SAT, ESAT, TARA, TMUA ve IGCSE öğrencileriyle birebir çalışıyor; ezber değil sınavın mantığını çözen bir sistem sunuyor.",
  credentials: ["Robert Kolej", "St. Joseph", "Liceo Italiano", "Üsküdar Amerikan"],
  photoPlaceholder: "Tutor Doğuhan",
  tangentCaption: "Uluslararası sınav hazırlığı ve üniversite ders desteği.",
};

export const resultsTestimonials = {
  eyebrow: "Öğrenci Deneyimi",
  headline: "111'den fazla değerlendirmeden bir kaçı.",
  functionPlotCaption: "Gerçek veli ve öğrenci yorumları.",
  testimonials: [
    {
      quote: "Oğlumun IB Fizik notu belirgin şekilde yükseldi, derse artık severek katılıyor.",
      name: "Ahu G.",
      context: "Veli · IB Fizik",
    },
    {
      quote: "Oğlumun IB HL Matematik ve Fizik'te motivasyonu ve özgüveni belirgin biçimde arttı.",
      name: "Yasemin T.",
      context: "Veli · IB HL Matematik & Fizik",
    },
    {
      quote: "Karmaşık konuları basit anlatımıyla öğretti; tüm matematik ve fizik sınavlarımı yüksek notla geçtim.",
      name: "Ahmet S.",
      context: "Öğrenci · Üniversite Fizik",
    },
    {
      quote: "Kısa sürede belirgin bir başarı sağladı, oldukça yetkin bir eğitimci.",
      name: "Ece A.",
      context: "Öğrenci · AYT Sınav Hazırlık",
    },
    {
      quote: "Geometriye karşı çekingenliğimi kısa sürede aştırdı, konuları sevdirerek ve pratik ipuçlarıyla öğretti.",
      name: "Ada Elif A.",
      context: "Öğrenci · Lise Matematik & Fizik",
    },
    {
      quote: "Kızımızın eksiklerini hızla tespit edip yazılı sınavına başarıyla hazırladı.",
      name: "Bülent I.",
      context: "Veli",
    },
  ],
};

export const pricingPreview = {
  eyebrow: "Ücretler",
  headline: "Ders Paket Ücretleri",
  body: "Daha fazla ders, daha avantajlı fiyat. Tanışma görüşmesi her zaman ücretsizdir.",
  featuredTag: "En Çok Tercih Edilen",
  ctaLabel: "Ücretsiz Tanışma Görüşmesi",
  tiers: [
    {
      id: "package5",
      name: "5 Derslik Paket",
      description: "Düzenli akademik destek",
      price: "₺15.000",
      cadence: "/ paket (%7 indirim)",
      features: ["60 dakikalık 5 birebir ders", "%7 paket indirimi", "Düzenli konu takibi"],
    },
    {
      id: "package10",
      name: "10 Derslik Paket",
      description: "Düzenli akademik destek",
      price: "₺27.000",
      cadence: "/ paket (%15 indirim)",
      featured: true,
      features: [
        "60 dakikalık 10 birebir ders",
        "%15 paket indirimi",
        "Sınav ve ödev takibi",
        "En çok tercih edilen paket",
      ],
    },
    {
      id: "package30",
      name: "30 Derslik Paket",
      description: "Uzun vadeli maksimum avantaj",
      price: "₺72.000",
      cadence: "/ paket (%25 indirim)",
      features: [
        "60 dakikalık 30 birebir ders",
        "%25 paket indirimi",
        "Sezon boyu kesintisiz destek",
        "En avantajlı birim fiyat (₺2.400)",
      ],
    },
  ],
};

export const bookingCTA = {
  headline: "Ücretsiz Tanışma Görüşmesi",
  body: "Formu doldurun, 24 saat içinde geri dönüş yapalım. İlk görüşme ücretsizdir.",
  successTitle: "Talebiniz alındı.",
  successBody: "Görüşmenizi planlamak için paylaştığınız iletişim bilgileri üzerinden size dönüş yapılacaktır.",
  form: {
    name: "Ad Soyad",
    email: "E-posta",
    interestLabel: "İlgilendiğim alan",
    interestOptions: [
      { value: "exam-preparation", label: "Sınav Hazırlığı" },
      { value: "university-support", label: "Üniversite Ders Desteği" },
      { value: "both", label: "Her İkisi" },
    ],
    messageLabel: "Mesaj",
    messageOptional: "(isteğe bağlı)",
    submit: "Ücretsiz Görüşme Talep Et",
    requiredLabel: "zorunlu",
    errorSummary: "Lütfen aşağıdaki alanları kontrol edin:",
    nameRequired: "Ad soyad alanı zorunludur.",
    emailRequired: "E-posta alanı zorunludur.",
    emailInvalid: "Geçerli bir e-posta adresi girin.",
  },
};

export const faq = {
  eyebrow: "SSS",
  headline: "Sık Sorulan Sorular",
  items: [
    {
      id: "faq-1",
      q: "Oriens Academy hangi sınav sistemlerini kapsıyor?",
      a: "IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT ve OMPT sınavlarını kapsıyoruz.",
    },
    {
      id: "faq-2",
      q: "Ders süresi ne kadardır?",
      a: "Tüm derslerimiz 60 dakika olarak birebir işlenmektedir.",
    },
    {
      id: "faq-3",
      q: "Ders ücretleri ne zamana kadar geçerlidir?",
      a: "Ders ücretlerimiz Haziran 2027 tarihine kadar sabittir.",
    },
    {
      id: "faq-4",
      q: "Üniversite ders desteğinde hangi dersler var?",
      a: "Calculus, Lineer Cebir, Diferansiyel Denklemler, İstatistik, Fizik I ve Fizik II derslerinde takviye sağlıyoruz.",
    },
    {
      id: "faq-5",
      q: "Tanışma görüşmesi ücretli mi?",
      a: "Hayır. İlk tanışma görüşmesi tamamen ücretsizdir.",
    },
  ],
};

export const examSelector = {
  heading: "Hangi sınava hazırlanıyorsun?",
  inputPlaceholder: "Sınav adı yazın — örn. SAT, IB, TMUA",
  noResults: "Eşleşen sınav bulunamadı.",
  otherLabel: "Diğer",
  otherInputLabel: "Hazırlandığınız sınavı yazın",
  otherPlaceholder: "Sınavın adını yazın",
  selectedSubtitle: "Uluslararası Sınav Hazırlığı",
  selectedSrAnnounce: "seçildi.",
  changeLabel: "Değiştir",
  listboxLabel: "Sınav sonuçları",
};

export const bookingFlow = {
  eyebrow: "Çevrimiçi Randevu",
  headline: "İlk akademik görüşmenizi planlayın.",
  subheadline: "Başlamak için uygun bir görüşme saati seçin ve akademik hedeflerinizi paylaşın.",
  steps: [
    { title: "Akademik Hedef", subtitle: "Destek alanını seçin" },
    { title: "Görüşme Zamanı", subtitle: "Tarih ve saat seçin" },
    { title: "İletişim Bilgileri", subtitle: "Kişisel bilgileriniz" },
    { title: "Onay ve Gönder", subtitle: "Son kontrol" },
  ],
  supportTypeOptions: [
    { value: "exam_preparation", label: "Sınav Hazırlığı", description: "IB, AP, SAT veya üniversite giriş sınavlarına yönelik özel destek." },
    { value: "university_support", label: "Üniversite Ders Desteği", description: "Calculus, Lineer Cebir, Fizik ve nicel ders desteği." },
    { value: "general_consultation", label: "Genel Akademik Danışmanlık", description: "Yol haritası analizi ve genel akademik strateji kurgusu." },
  ],
  step1: {
    title: "Öncelikli akademik hedefiniz nedir?",
    notesLabel: "Eklemek istedikleriniz veya özel hedefleriniz",
    notesPlaceholder: "Mevcut hedef notlarınız, yaklaşan sınav tarihleriniz veya odaklanmak istediğiniz detayları paylaşabilirsiniz...",
  },
  step2: {
    title: "Uygun bir görüşme zamanı seçin",
    emptyStateTitle: "Şu anda çevrimiçi takvimde uygun görüşme saati görünmüyor.",
    emptyStateBody: "Mevcut çevrimiçi randevu saatleri dolmuştur. Doğrudan bizimle iletişime geçerek randevu oluşturabilirsiniz.",
    contactCta: "Doğrudan İletişime Geçin",
    timezoneNotice: "Tüm saatler yerel saat diliminize göre gösterilmektedir:",
    slotSelected: "Seçilen randevu saati:",
  },
  step3: {
    title: "İletişim bilgilerinizi girin",
    phoneLabel: "Telefon numarası",
    phoneOptional: "(isteğe bağlı)",
    privacyConsentLabel: "Görüşmenin planlanması amacıyla iletişim bilgilerimin işlenmesini onaylıyorum.",
    privacyConsentRequired: "Devam edebilmek için gizlilik onayını kabul etmelisiniz.",
    marketingConsentLabel: "Akademik rehberlik yazıları ve gelişmelerden haberdar olmak istiyorum (isteğe bağlı).",
  },
  step4: {
    title: "Randevu talebinizi kontrol edin ve onaylayın",
    academicSummary: "Akademik Odak",
    slotSummary: "Görüşme Zamanı",
    contactSummary: "İletişime Geçilecek Kişi",
    notesSummary: "Notlar",
    submitButton: "Randevu Talebini Onayla ve Gönder",
    submittingButton: "Randevu Talebi Alınıyor...",
  },
  slotUnavailableNotice: "Seçtiğiniz randevu saati az önce başka bir ziyaretçi tarafından alındı. Lütfen başka bir saat seçin.",
  success: {
    title: "Randevu talebiniz alındı.",
    body: "Randevu talebiniz başarıyla iletilmiş olup onay bekliyor durumundadır. Paylaştığınız iletişim bilgileri üzerinden kısa süre içinde sizinle iletişime geçilecektir.",
    referenceLabel: "Randevu Referansı:",
    homeCta: "Ana Sayfaya Dön",
  },
  actions: {
    back: "Geri",
    continue: "Devam Et",
  },
};
