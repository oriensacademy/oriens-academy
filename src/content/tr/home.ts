import { Fingerprint, Globe2, Target, Users, type LucideIcon } from "lucide-react";

/** Turkish — homepage-specific copy. */

export const hero = {
  eyebrow: "Uluslararası Eğitim Danışmanlığı",
  headline: "Hedeflediğiniz üniversiteye giden rotanız.",
  body: "Oriens Academy, titiz sınav hazırlığını bireysel akademik rehberlikle birleştirir — IB, AP, SAT sınavlarına ve dünya genelinde üniversite başvurularına yön bulan öğrenciler için.",
  ctaPrimary: "Ücretsiz Görüşme Planla",
  ctaSecondary: "Metodu İncele",
};

export const trustResults = {
  eyebrow: "Akademik hedefe göre yapılandırılmış destek",
  items: [
    { title: "Uluslararası sınav hazırlığı", description: "On iki sınav için ayrı içerik ve ortak bir planlama yaklaşımı." },
    { title: "Üniversite ders desteği", description: "Kavram tekrarı, problem çözme ve planlı çalışma odağı." },
    { title: "Türkçe ve İngilizce", description: "İki dilde erişilebilen akademik içerik ve görüşme akışı." },
    { title: "Şeffaf ücretlendirme", description: "Program seçenekleri ve başlangıç ücretleri ayrı bir sayfada açıkça sunulur." },
  ],
};

export const examPreparation = {
  eyebrow: "Sınav Hazırlığı",
  headline: "On iki sınav. Tek bir titiz metot.",
  body: "Öğrenciyle hedeflediği üniversite arasında hangi sınav olursa olsun, hazırlık aynı disiplinli süreci izler — teşhis edilir, rotası çizilir, ölçülür.",
  categories: [
    {
      label: "Lise ve Üniversiteye Giriş",
      exams: ["IB", "AP", "IGCSE", "SAT", "TMUA", "ESAT"],
    },
    {
      label: "Özel Kabul Sınavları",
      exams: ["UKCAT", "IMAT", "OMPT", "TARA"],
    },
    {
      label: "Lisansüstü Sınavlar",
      exams: ["GRE", "GMAT"],
    },
  ],
};

export const oriensMethod = {
  eyebrow: "Oriens Metodu",
  headline: "Altı aşama. Tek bir kesintisiz rota.",
  stages: [
    {
      n: "01",
      name: "Anla",
      copy: "Kapsamlı bir akademik değerlendirme: güçlü yönler, eksikler ve hedeflediğiniz nokta.",
    },
    {
      n: "02",
      name: "Planla",
      copy: "Bulunduğunuz noktadan hedefinize uzanan rotayı çiziyoruz — dersler, zaman çizelgesi, sınavlar.",
    },
    {
      n: "03",
      name: "Hazırlan",
      copy: "Çizilen rotaya göre yapılandırılmış, uzman eşliğinde çalışma — hazır bir müfredat değil.",
    },
    {
      n: "04",
      name: "Ölç",
      copy: "Gerçek sınav koşullarında düzenli değerlendirme — ilerleme varsayılmaz, ölçülür.",
    },
    {
      n: "05",
      name: "İyileştir",
      copy: "Sonuçlar geldikçe plan güncellenir. Hassasiyet katlanarak artar.",
    },
    {
      n: "06",
      name: "İlerle",
      copy: "Başvurular, mülakatlar ve kabul mektubuna giden son adım.",
    },
  ],
};

export const signatureMathematics = {
  eyebrow: "Hassasiyet, Kanıtlanmış",
  headline: "Noktayı hareket ettirin. Teğetin nasıl değiştiğini izleyin.",
  body: "Öğrencilerimizin sınav gününe taşıdığı hassasiyet tam olarak budur — ezberlenmiş bir cevap değil, kavranmış kesin bir ilişki.",
  sliderLabel: "Eğri üzerindeki konum",
  readout: { point: "Nokta", value: "Değer", slope: "Eğim" },
};

export const universitySupport = {
  eyebrow: "Üniversite Ders Desteği",
  headline: "Lisans eğitimi rehberliği bitirmez, yalnızca biçimini değiştirir.",
  areas: [
    {
      n: "I",
      title: "Ders Ödevleri ve Problem Setleri",
      copy: "Fen, mühendislik ve sayısal derslerde haftalık destek — problem setlerinden laboratuvar raporlarına.",
    },
    {
      n: "II",
      title: "Tez ve Araştırma Danışmanlığı",
      copy: "Tez düzeyinde argüman kurgusu, metodoloji ve akademik yazım.",
    },
    {
      n: "III",
      title: "Sınav ve Vize Yoğunlaştırılmış Programları",
      copy: "Finallerden önce odaklı tekrar programları — sınavda gerçekten çıkan konular.",
    },
    {
      n: "IV",
      title: "Üniversite İçin Çalışma Becerileri",
      copy: "Zaman yönetimi, not tutma sistemleri ve liseden üniversiteye geçişin gerektirdiği bağımsız çalışma yöntemi.",
    },
  ],
  visualCaption: "Birinci sınıftan mezuniyete — tek ve kararlı bir yön.",
};

export const whyOriens = {
  eyebrow: "Neden Oriens?",
  headline: "Doğru rota için gerekenler.",
  reasons: [
    {
      icon: Fingerprint as LucideIcon,
      title: "Kişiye özel, şablona bağlı değil",
      copy: "Her plan öğrenciye özel olarak hazırlanır — toptan uygulanan hazır bir müfredat asla.",
    },
    {
      icon: Target as LucideIcon,
      title: "Varsayım değil, veri",
      copy: "Her öneri gerçek değerlendirme verileriyle desteklenir; sürekli takip edilir ve güncellenir.",
    },
    {
      icon: Globe2 as LucideIcon,
      title: "Uluslararası sınav odağı",
      copy: "IB, AP, SAT ve diğer uluslararası sınavlar için sınava özel hazırlık içerikleri sunulur.",
    },
    {
      icon: Users as LucideIcon,
      title: "Bireysel çalışma yaklaşımı",
      copy: "Çalışma odağı öğrencinin ihtiyacına, mevcut düzeyine ve akademik hedefine göre netleştirilir.",
    },
  ],
};

export const instructorAbout = {
  eyebrow: "Akademik Rehberlik",
  name: "Kişiye özel bir akademik rota",
  body: "Oriens, sınav hazırlığı ile üniversite düzeyindeki akademik desteği öğrencinin ihtiyacına göre planlanan bir çalışma sürecinde bir araya getirir.",
  credentials: ["İhtiyaç analizi", "Konu odaklı hazırlık", "İlerleme değerlendirmesi"],
  photoPlaceholder: "Oriens akademik yaklaşımı",
  tangentCaption: "Her aşamada netleşen bir çalışma yönü.",
};

export const resultsTestimonials = {
  eyebrow: "Öğrenci Deneyimi",
  headline: "Doğrulanmış deneyimler.",
  functionPlotCaption: "Akademik süreç, düzenli değerlendirmeyle izlenir.",
  testimonials: [] as Array<{ quote: string; name: string; context: string }>,
};

export const pricingPreview = {
  eyebrow: "Ücretler",
  headline: "Takvime değil, hedefe göre kurgulanan programlar.",
  body: "İlk görüşmenin ardından size özel tam bir teklif sunulur. Aşağıdakiler bir başlangıç noktasıdır.",
  featuredTag: "En Çok Tercih Edilen",
  ctaLabel: "Ücretsiz Görüşme Planla",
  tiers: [
    {
      id: "foundation",
      name: "Temel",
      description: "Tek bir derse odaklı hazırlık için.",
      price: "90€'dan başlayan",
      cadence: "/ seans",
      features: ["Haftalık birebir dersler", "Kapsamlı değerlendirme", "İlerleme raporlaması"],
    },
    {
      id: "method",
      name: "Metot",
      description: "Çok dersli, kapsamlı sınav hazırlık programımız.",
      price: "320€'dan başlayan",
      cadence: "/ ay",
      featured: true,
      features: [
        "Temel pakette olan her şey",
        "Kapsamlı Oriens Metodu planlaması",
        "İki haftada bir deneme sınavı",
        "Eğitmene doğrudan erişim",
      ],
    },
    {
      id: "immersive",
      name: "Tam Kapsamlı",
      description: "Üniversite başvuru sürecinin sonuna kadar kapsamlı destek.",
      price: "Özel Teklif",
      cadence: "",
      features: [
        "Metot pakette olan her şey",
        "Üniversite başvuru danışmanlığı",
        "Mülakat hazırlığı",
        "Size özel süreç sorumlusu",
      ],
    },
  ],
};

export const bookingCTA = {
  headline: "Bir görüşmeyle başlayın.",
  body: "Ücretsiz ilk görüşmede öğrencinin bugün nerede olduğunu ve hedefe giden gerçekçi rotanın nasıl göründüğünü birlikte değerlendiririz.",
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
    submit: "Görüşme Talep Et",
    requiredLabel: "zorunlu",
    errorSummary: "Lütfen aşağıdaki alanları kontrol edin:",
    nameRequired: "Ad soyad alanı zorunludur.",
    emailRequired: "E-posta alanı zorunludur.",
    emailInvalid: "Geçerli bir e-posta adresi girin.",
  },
};

export const faq = {
  eyebrow: "SSS",
  headline: "Sorularınızı doğrudan yanıtlıyoruz.",
  items: [
    {
      id: "faq-1",
      q: "Oriens Academy hangi sınav sistemlerini kapsıyor?",
      a: "Lise düzeyinde IB, AP, IGCSE, SAT, TMUA ve ESAT; özel kabul sınavlarında UKCAT, IMAT, OMPT ve TARA; lisansüstü düzeyde ise GRE ve GMAT.",
    },
    {
      id: "faq-2",
      q: "Dersler yüz yüze mi, çevrimiçi mi yapılıyor?",
      a: "İkisi de mümkün. Öğrencilerimizin çoğu süreç boyunca aynı eğitmenle uzaktan çalışıyor; yüz yüze dersler ise belirli şehirlerde sunuluyor.",
    },
    {
      id: "faq-3",
      q: "Bir öğrencinin programı nasıl belirleniyor?",
      a: "Her program kapsamlı bir değerlendirmeyle başlar. Metot — Anla, Planla, Hazırlan, Ölç, İyileştir, İlerle — önceden varsayılmaz, bu sonuca göre kurgulanır.",
    },
    {
      id: "faq-4",
      q: "Zaten üniversitede olan öğrencilere de destek veriyor musunuz?",
      a: "Evet — ders desteği, tez ve araştırma danışmanlığı ile sınav yoğunlaştırılmış programları, yalnızca kabul öncesinde değil, lisans ya da lisansüstü eğitim boyunca da sunulur.",
    },
    {
      id: "faq-5",
      q: "Görüşmeden sonra süreç nasıl işliyor?",
      a: "İki iş günü içinde; önerilen programı, sıklığı ve hedef sınava ya da başvuru dönemine giden ilk zaman çizelgesini içeren yazılı bir teklif alırsınız.",
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
    { value: "university_support", label: "Üniversite Ders Desteği", description: "Lisans dersleri, nicel alanlar ve tez rehberliği." },
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

