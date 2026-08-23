import type { ExamCategoryId, ExamTextMap } from "../exams";
export { examDetailText } from "./exam-details";

export const metadata = {
  title: "Sınav Hazırlığı | Oriens Academy",
  description:
    "IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT ve OMPT için hedefe yönelik sınav hazırlığı ve akademik rehberlik.",
};

export const page = {
  eyebrow: "Sınav Hazırlığı",
  title: "Uluslararası sınavlarda doğru rota.",
  lead:
    "Hedefinizi, akademik geçmişinizi ve başvuru takviminizi birlikte okuyarak hangi sınava, ne zaman ve nasıl hazırlanmanız gerektiğini netleştiriyoruz.",
  heroNote: "Hedef → Strateji → İlerleme",
  indexLabel: "Sınav indeksi",
  indexHint: "Bir sınava doğrudan gidin veya akademik aşamaya göre keşfedin.",
  featuredEyebrow: "Öne çıkan rotalar",
  featuredTitle: "Her hedef, farklı bir hazırlık sistemi ister.",
  featuredBody:
    "Program yeterliliğinden lisans ve lisansüstü kabule kadar her sınavı kendi ölçme mantığı içinde ele alıyoruz.",
  groupsEyebrow: "Akademik navigasyon",
  groupsTitle: "Hedefinize göre sınavları keşfedin.",
  supportLabel: "Oriens desteği",
  purposeLabel: "Kullanım amacı",
  subjectsLabel: "Çalışma alanları",
  audienceLabel: "Kimler için",
  categoryAlso: "Ayrıca ilgili",
  cta: {
    eyebrow: "Rotanızı birlikte belirleyelim",
    title: "Hangi sınavın sizin için doğru olduğundan emin değil misiniz?",
    body:
      "Hedef üniversitenizi ve mevcut seviyenizi değerlendirerek size uygun sınav ve çalışma planını netleştirelim.",
    primary: "Ücretsiz Görüşme Planla",
    secondary: "İletişime Geç",
  },
};

export const detailPage = {
  breadcrumbAria: "Sayfa yolu",
  home: "Ana Sayfa",
  exams: "Sınavlar",
  overviewEyebrow: "Sınavı tanıyın",
  overviewTitle: (code: string) => `${code} nedir?`,
  audienceLabel: "Kimler için?",
  purposeLabel: "Ne için kullanılır?",
  coverageEyebrow: "Akademik kapsam",
  coverageTitle: "Neyi değerlendirir veya kapsar?",
  supportEyebrow: "Oriens yaklaşımı",
  supportTitle: "Hazırlık sürecini nasıl destekliyoruz?",
  preparationEyebrow: "Çalışma sistemi",
  preparationTitle: "Hazırlık alanları",
  factsLabel: "Akademik referans",
  officialNote: "Sınav yapısı, kapsamı, tarihler ve kayıt koşulları değişebilir. Başvuru döneminiz için güncel bilgileri resmî sınav sağlayıcısından ve hedef kurumunuzdan doğrulayın.",
  relatedEyebrow: "Sonraki yönler",
  relatedTitle: "İlgili sınavlar",
  faqEyebrow: "Sık sorulanlar",
  faqTitle: "Hazırlık öncesinde bilinmesi gerekenler",
  primaryCta: "Ücretsiz Görüşme Planla",
  secondaryCta: "Sınavlara Dön",
  visualLabel: (code: string) => `${code} için akademik navigasyon görseli`,
};

export const categories: Record<ExamCategoryId, { label: string; description: string }> = {
  "university-admissions": {
    label: "Lisans Kabul Sınavları",
    description: "Uluslararası ve programa özgü lisans başvurularında kullanılan kabul sınavları.",
  },
  "academic-programmes": {
    label: "Akademik Programlar",
    description: "Lise düzeyinde uluslararası müfredat, ders ve yeterlilik sınavları.",
  },
  "medical-admissions": {
    label: "Tıp Kabul Sınavları",
    description: "Birleşik Krallık ve İtalya'daki tıp programlarına yönelik seçme sınavları.",
  },
  "graduate-admissions": {
    label: "Lisansüstü Kabul Sınavları",
    description: "Yüksek lisans, doktora ve işletme okulu başvurularında kullanılan sınavlar.",
  },
};

export const examText: ExamTextMap = {
  IB: {
    title: "International Baccalaureate",
    shortDescription: "IB Diploma Programme dersleri, iç değerlendirmeleri ve final sınavları için bütünlüklü destek.",
    purpose: "Uluslararası lise diploması ve dünya genelinde üniversite başvuruları",
    audience: "IB DP öğrencileri",
    subjects: ["Matematik AA/AI", "Fizik", "Kimya", "IA stratejisi"],
    ctaLabel: "IB hazırlığını keşfet",
  },
  AP: {
    title: "Advanced Placement",
    shortDescription: "AP ders içeriğini sınav formatı ve üniversite kredisi hedefleriyle birleştiren hazırlık.",
    purpose: "Lise düzeyinde ileri ders yeterliliği ve olası üniversite kredisi",
    audience: "AP dersi alan lise öğrencileri",
    subjects: ["Calculus", "Statistics", "Physics", "Chemistry"],
    ctaLabel: "AP hazırlığını keşfet",
  },
  SAT: {
    title: "SAT",
    shortDescription: "Dijital SAT için teşhis, konu kapatma, süre yönetimi ve deneme analizi odaklı plan.",
    purpose: "Başta ABD olmak üzere lisans başvurularında akademik yeterlilik göstergesi",
    audience: "Uluslararası lisans adayları",
    subjects: ["Reading & Writing", "Math", "Digital strategy"],
    ctaLabel: "SAT hazırlığını keşfet",
  },
  ESAT: {
    title: "Engineering and Science Admissions Test",
    shortDescription: "Mühendislik ve fen programları için modül seçimine uygun, ileri düzey problem çözme hazırlığı.",
    purpose: "Seçili Birleşik Krallık mühendislik ve fen programlarına kabul",
    audience: "Mühendislik ve fen bilimleri adayları",
    subjects: ["Mathematics 1", "Mathematics 2", "Physics", "Chemistry"],
    ctaLabel: "ESAT hazırlığını keşfet",
  },
  TARA: {
    title: "Test of Academic Reasoning for Admissions",
    shortDescription: "Konu bilgisinden bağımsız akıl yürütme, problem çözme ve açık yazım becerilerine hazırlık.",
    purpose: "Oxford ve UCL'deki seçili lisans programlarına kabul",
    audience: "TARA isteyen programlara başvuran adaylar",
    subjects: ["Critical Thinking", "Problem Solving", "Writing Task"],
    ctaLabel: "TARA hazırlığını keşfet",
  },
  TMUA: {
    title: "Test of Mathematics for University Admission",
    shortDescription: "İleri matematiksel düşünme ve zaman baskısı altında ispat temelli akıl yürütme hazırlığı.",
    purpose: "Seçili Birleşik Krallık matematik, ekonomi ve bilgisayar bilimi programlarına kabul",
    audience: "Matematik yoğun program adayları",
    subjects: ["Mathematical Thinking", "Reasoning", "Problem Solving"],
    ctaLabel: "TMUA hazırlığını keşfet",
  },
  IGCSE: {
    title: "International GCSE",
    shortDescription: "Temeli sağlamlaştıran, müfredat kapsamı ve soru tipi hâkimiyetini birlikte geliştiren destek.",
    purpose: "Uluslararası ortaöğretim yeterliliği ve ileri akademik programlara geçiş",
    audience: "IGCSE öğrencileri",
    subjects: ["Mathematics", "Additional Mathematics", "Sciences"],
    ctaLabel: "IGCSE hazırlığını keşfet",
  },
  GRE: {
    title: "Graduate Record Examination",
    shortDescription: "Lisansüstü başvurular için nicel akıl yürütme, sözel analiz ve analitik yazma planı.",
    purpose: "Uluslararası yüksek lisans ve doktora programlarına kabul",
    audience: "Lisansüstü eğitim adayları",
    subjects: ["Quantitative", "Verbal", "Analytical Writing"],
    ctaLabel: "GRE hazırlığını keşfet",
  },
  GMAT: {
    title: "Graduate Management Admission Test",
    shortDescription: "İşletme okulu başvuruları için veri, nicel ve sözel akıl yürütmeyi bütünleyen hazırlık.",
    purpose: "MBA ve diğer lisansüstü işletme programlarına kabul",
    audience: "İşletme okulu adayları",
    subjects: ["Quantitative", "Verbal", "Data Insights"],
    ctaLabel: "GMAT hazırlığını keşfet",
  },
  UKCAT: {
    title: "UKCAT / UCAT",
    shortDescription: "Güncel adı UCAT olan sınav için bilişsel beceri, karar verme ve süre yönetimi hazırlığı.",
    purpose: "Birleşik Krallık'taki seçili tıp ve diş hekimliği programlarına kabul",
    audience: "Tıp ve diş hekimliği adayları",
    subjects: ["Verbal Reasoning", "Decision Making", "Quantitative Reasoning", "SJT"],
    ctaLabel: "UKCAT / UCAT hazırlığını keşfet",
  },
  IMAT: {
    title: "International Medical Admissions Test",
    shortDescription: "İtalya'daki İngilizce tıp programları için bilimsel bilgi ve akıl yürütme hazırlığı.",
    purpose: "İtalya'daki İngilizce eğitim veren seçili tıp programlarına kabul",
    audience: "İtalya'da tıp okumak isteyen adaylar",
    subjects: ["Biology", "Chemistry", "Physics", "Mathematics", "Reasoning"],
    ctaLabel: "IMAT hazırlığını keşfet",
  },
  OMPT: {
    title: "Online Mathematics Placement Test",
    shortDescription: "Üniversite veya programın istediği OMPT türüne göre matematik yeterliliğini kanıtlamaya hazırlık.",
    purpose: "Uluslararası öğrenciler için programa özgü matematik kabul şartını karşılama",
    audience: "OMPT isteyen programlara başvuran adaylar",
    subjects: ["Programa özgü matematik", "Cebir ve fonksiyonlar", "Test türüne bağlı konular"],
    ctaLabel: "OMPT hazırlığını keşfet",
  },
};
