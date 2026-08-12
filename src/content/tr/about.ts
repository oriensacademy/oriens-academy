import type { AboutContent } from "../about";

export const about: AboutContent = {
  metadata: {
    title: "Hakkımızda | Oriens Academy",
    description: "Oriens Academy'nin bireysel ihtiyaç analizi, akademik yönlendirme ve düzenli ilerleme değerlendirmesine dayanan destek yaklaşımını keşfedin.",
  },
  breadcrumb: { ariaLabel: "Sayfa yolu", home: "Ana Sayfa", current: "Hakkımızda" },
  hero: {
    eyebrow: "Oriens Academy hakkında",
    title: "Akademik hedefe giden yol, doğru yönü bulmakla başlar.",
    description: "Oriens, öğrencinin önündeki konuyu, sınavı veya akademik dönemi tek bir kalıba sıkıştırmadan ele alır. İhtiyacı netleştirir, çalışma rotasını görünür kılar ve süreci düzenli değerlendirmelerle takip eder.",
    primaryCta: "Ücretsiz Görüşme Planla",
    secondaryCta: "Yaklaşımımızı İncele",
    visualLabel: "Öğrenciden akademik hedefe uzanan rehberlik rotası",
    visualSteps: ["Öğrenci", "Yön", "Akademik rota", "Hedef"],
  },
  story: {
    eyebrow: "Yaklaşımımız",
    title: "Hazır bir reçete değil, öğrencinin mevcut konumundan başlayan bir çalışma sistemi.",
    paragraphs: [
      "Aynı sınava hazırlanan veya aynı dersi alan iki öğrencinin ihtiyacı aynı olmayabilir. Bu nedenle süreç, öğrencinin hedefini, mevcut seviyesini, zamanını ve zorlandığı noktaları anlamakla başlar.",
      "Akademik rota; kavram tekrarı, konu odaklı çalışma, problem çözme pratiği ve ilerleme değerlendirmesini birbirine bağlar. Gerektiğinde öncelikler yeniden belirlenir; amaç, çalışmayı daha açık ve yönetilebilir hâle getirmektir.",
    ],
    note: "Bu yaklaşım; sınav hazırlığı, üniversite ders desteği ve bireysel akademik rehberlik içeriklerinde kullanılan mevcut Oriens çalışma çerçevesinden türetilmiştir.",
  },
  principles: {
    eyebrow: "İlkeler",
    title: "Yönü belirleyen beş akademik ilke.",
    intro: "Her ilke, mevcut hizmet akışında karşılığı olan somut bir çalışma kararını ifade eder.",
    items: [
      { id: "direction", title: "Yön", description: "Çalışma başlamadan önce hedef, mevcut konum ve öncelikler netleştirilir." },
      { id: "individualisation", title: "Bireysellik", description: "Plan, genel bir şablona değil öğrencinin ihtiyacına ve akademik takvimine göre kurulur." },
      { id: "clarity", title: "Netlik", description: "Kavramlar, ilişkiler ve çözüm adımları ezberden önce anlaşılır bir yapıya yerleştirilir." },
      { id: "review", title: "Değerlendirme", description: "Hatalar ve ilerleme düzenli olarak gözden geçirilir; rota gerektiğinde yeniden önceliklendirilir." },
      { id: "integrity", title: "Akademik bütünlük", description: "Destek, öğrencinin yerine üretmek için değil, bağımsız çalışma becerisini geliştirmek için verilir." },
    ],
  },
  team: {
    eyebrow: "İnsan desteği",
    title: "Danışmanlık ve eğitmen yapısı, öğrencinin ihtiyacı etrafında çalışır.",
    intro: "Bireysel desteğin insan tarafı; öğrenciyi dinlemek, akademik ihtiyacı doğru tanımlamak ve çalışma boyunca açık geri bildirim sağlamaktır.",
    members: [],
    fallbackTitle: "Kişi profilinden önce çalışma ilişkisi",
    fallbackBody: "Destek ilişkisi, ihtiyacın birlikte tanımlanmasıyla başlar; konu odağı ve çalışma öncelikleri netleştirilir, ilerleme düzenli olarak gözden geçirilir. Böylece insan desteği, genel tavsiyeler yerine öğrencinin gerçek akademik gündemine bağlanır.",
    fallbackPoints: ["İhtiyacı birlikte tanımlama", "Konu ve soru odağını belirleme", "İlerlemeyi düzenli gözden geçirme"],
  },
  brandMoment: {
    eyebrow: "Oriens yönü",
    title: "Pusula, cevabı değil yönü temsil eder.",
    body: "Öğrenci başlangıç noktasını getirir; rehberlik doğru yönü ve akademik rotayı görünür kılar. Hedefe doğru ilerleyen çalışma ise öğrencinin aktif katılımıyla şekillenir.",
    steps: ["Öğrenci", "Yön", "Akademik rota", "Hedef"],
  },
  outcomes: {
    eyebrow: "Gelişim alanları",
    title: "Süreçte geliştirmeyi hedeflediğimiz akademik alışkanlıklar.",
    intro: "Doğrulanmış sayısal sonuçlar yayımlanmadığı için burada oran veya sayaç kullanılmıyor. Bunun yerine desteğin yöneldiği nitel gelişim alanları açıkça tanımlanıyor.",
    metrics: [],
    items: [
      { title: "Konu hâkimiyeti", description: "Temel kavramlar ve aralarındaki ilişkiler üzerinde daha sağlam bir anlayış kurmayı hedeflemek." },
      { title: "Problem çözme disiplini", description: "Soruyu analiz etme, uygun yöntemi seçme ve sonucu kontrol etme alışkanlığını geliştirmek." },
      { title: "Planlı çalışma", description: "Konuları ve yaklaşan değerlendirmeleri yönetilebilir önceliklere dönüştürmek." },
      { title: "Değerlendirmeye hazırlık", description: "Quiz, sınav, vize veya final öncesinde eksikleri kontrollü tekrar ve pratikle ele almak." },
      { title: "Akademik bağımsızlık", description: "Öğrencinin kendi öğrenme kararlarını daha bilinçli verebilmesine destek olmak." },
    ],
    disclaimer: "Bunlar garanti edilen sonuçlar değil, bireysel akademik destek sürecinin geliştirmeyi amaçladığı alanlardır.",
  },
  trust: {
    eyebrow: "Doğrulanabilir kapsam",
    title: "Güven, iddialı rakamlardan önce açık bir sistem gerektirir.",
    intro: "Oriens'in şu anda proje içinde doğrulanabilen hizmet kapsamı ve kullanıcı akışları:",
    examLabel: "Mevcut sınav kataloğu",
    links: [
      { route: "exams", title: "Uluslararası sınav hazırlığı", description: "Merkezi içerik modelinde yayımlanan sınavlar ve sınava özel hazırlık sayfaları.", linkLabel: "Sınavları incele" },
      { route: "universitySupport", title: "Üniversite ders desteği", description: "Ders içeriğini anlama, kavram tekrarı, problem çözme ve çalışma planlama desteği.", linkLabel: "Üniversite desteğini incele" },
      { route: "pricing", title: "Şeffaf ücret yapısı", description: "Yayımlanan paket kapsamları, ücretler ve çalışma seçenekleri.", linkLabel: "Ücretleri incele" },
    ],
  },
  testimonials: { eyebrow: "Öğrenci deneyimi", title: "Doğrulanmış deneyimler", items: [] },
  cta: {
    eyebrow: "İlk yön noktası",
    title: "Akademik hedefinizi birlikte netleştirelim.",
    body: "İhtiyacınızı, mevcut seviyenizi ve önünüzdeki akademik takvimi konuşarak uygun destek rotasını belirleyelim.",
    primary: "Ücretsiz Görüşme Planla",
    secondary: "İletişime Geç",
  },
};
