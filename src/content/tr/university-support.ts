import type { UniversitySupportContent } from "../university-support";

export const universitySupport = {
  metadata: {
    title: "Üniversite Ders Desteği | Oriens Academy",
    description:
      "Üniversite öğrencileri için bireysel akademik destek; ders içeriğini anlama, kavram tekrarı, problem çözme ve sınav dönemlerini planlama.",
  },
  breadcrumb: { ariaLabel: "Sayfa yolu", home: "Ana Sayfa", current: "Üniversite Ders Desteği" },
  hero: {
    eyebrow: "Üniversite Ders Desteği",
    title: "Dersi geçmenin ötesinde, konuyu gerçekten kavramak.",
    description:
      "Oriens, üniversite öğrencilerine dersin kendi içeriği ve takvimi üzerinden bireysel akademik yol gösterir; kavramları netleştirir, problem çözme sürecini yapılandırır ve çalışmayı takip edilebilir hâle getirir.",
    primaryCta: "Ücretsiz Görüşme Planla",
    secondaryCta: "Destek Alanlarını İncele",
    visualLabel: "Üniversite öğrenimi, planlama ve geri bildirim için akademik destek çizimi",
    visualNote: "Kavram · uygulama · geri bildirim",
  },
  audience: {
    eyebrow: "Kimler için?",
    title: "Dersin içinde yönünü kaybetmek zorunda değilsiniz.",
    intro:
      "Destek, genel bir hazır program yerine öğrencinin aldığı ders, mevcut seviyesi ve yakın akademik sorumlulukları üzerinden şekillenir.",
    items: [
      { title: "Ders içeriğini anlamak isteyenler", description: "Ders notları ve kaynaklardaki temel kavramları birbirine bağlamak isteyen üniversite öğrencileri." },
      { title: "Değerlendirme dönemine hazırlananlar", description: "Quiz, vize veya final öncesinde eksiklerini belirleyip kontrollü tekrar yapmak isteyenler." },
      { title: "Problem çözmede desteğe ihtiyaç duyanlar", description: "Çözüm ezberlemek yerine soruyu analiz etmeyi ve uygun yöntemi seçmeyi geliştirmek isteyenler." },
    ],
  },
  areas: {
    eyebrow: "Akademik destek alanları",
    title: "Ders adına değil, öğrencinin gerçek akademik ihtiyacına göre.",
    intro:
      "Mevcut Oriens içeriğinin doğruladığı destek çerçevesi aşağıdadır. Belirli ders kapsamı, öğrencinin ders izlencesi ve materyalleri incelendikten sonra netleştirilir.",
    indexLabel: "Destek indeksi",
    categoryLabels: {
      quantitative: "STEM ve sayısal",
      assessment: "Değerlendirme hazırlığı",
      "academic-work": "Akademik çalışma",
      "study-systems": "Çalışma sistemi",
    },
    items: [
      {
        id: "coursework-problem-sets",
        slug: "ders-odevleri-problem-setleri",
        title: "Ders Ödevleri ve Problem Setleri",
        shortDescription: "STEM ve sayısal derslerde kavramları haftalık çalışma, ders materyali ve problem setleri üzerinden yapılandıran bireysel destek.",
        category: "quantitative",
        topics: ["Kavram tekrarı", "Problem çözme", "Haftalık çalışma"],
        featured: true,
        order: 1,
      },
      {
        id: "assessment-review",
        slug: "sinav-vize-final-hazirligi",
        title: "Quiz, Vize ve Final Hazırlığı",
        shortDescription: "Ders kapsamını önceliklendirerek eksikleri, tekrar sırasını ve soru pratiğini yönetilebilir bir plana dönüştürme.",
        category: "assessment",
        topics: ["Konu haritası", "Odaklı tekrar", "Soru pratiği"],
        featured: false,
        order: 2,
      },
      {
        id: "academic-work",
        slug: "akademik-calisma-rehberligi",
        title: "Akademik Çalışma Rehberliği",
        shortDescription: "Mevcut proje kapsamındaki laboratuvar raporu, araştırma ve tez çalışmalarında yapı, metodoloji ve akademik yazım odağı.",
        category: "academic-work",
        topics: ["Argüman yapısı", "Metodoloji", "Akademik yazım"],
        featured: false,
        order: 3,
      },
      {
        id: "study-skills",
        slug: "universite-calisma-becerileri",
        title: "Üniversite Çalışma Becerileri",
        shortDescription: "Zaman yönetimi, not sistemi ve bağımsız çalışma alışkanlıklarını ders yüküne uyarlama.",
        category: "study-systems",
        topics: ["Zaman yönetimi", "Not sistemi", "Bağımsız çalışma"],
        featured: false,
        order: 4,
      },
    ],
    scopeNote:
      "Destek kapsamı, öğrencinin bölümüne ilişkin genel bir uzmanlık iddiası değil; paylaşılan ders içeriğine göre yapılan ön değerlendirme sonucunda belirlenir.",
  },
  method: {
    eyebrow: "Oriens nasıl çalışır?",
    title: "Önce mevcut konumu, sonra doğru çalışma rotasını belirleriz.",
    intro: "Süreç, uydurma bir formüle değil; ihtiyaç analizi, açık öncelikler ve düzenli gözden geçirmeye dayanır.",
    steps: [
      { id: "analyse", title: "İhtiyacı analiz et", description: "Ders izlencesi, materyaller, yaklaşan değerlendirmeler ve öğrencinin zorlandığı noktalar birlikte incelenir." },
      { id: "map", title: "Konu haritasını çıkar", description: "Ön koşullar, güncel konular ve eksikler görünür bir sıraya yerleştirilir." },
      { id: "practise", title: "Kavramı uygula", description: "Kısa kavram tekrarları kontrollü problem ve soru pratiğiyle ilişkilendirilir." },
      { id: "review", title: "İlerlemeyi gözden geçir", description: "Hatalar ve yeni ihtiyaçlar değerlendirilir; çalışma rotası gerektiğinde yeniden önceliklendirilir." },
    ],
  },
  visual: {
    eyebrow: "Akademik derinlik",
    title: "Bir noktadaki zorluk, bütün konunun anlaşılmaz olduğu anlamına gelmez.",
    description:
      "Bireysel destek, öğrencinin zorlandığı noktayı belirler; kavramı açıklama, kontrollü uygulama ve geri bildirim adımlarıyla yeniden yapılandırır.",
    caption: "Kavram analizi, uygulama planı ve geri bildirim aynı akademik destek sistemi içinde ilerler.",
    labels: { function: "analiz", tangent: "uygulama", point: "geri bildirim" },
    ariaLabel: "Analiz, uygulama ve geri bildirim aşamalarını gösteren üniversite akademik destek çizimi",
  },
  approach: {
    eyebrow: "Çalışma yaklaşımı",
    title: "Anlatım, uygulama ve geri bildirim aynı sistemde.",
    items: [
      { title: "Kavramı netleştir", description: "Tanım, ilişki ve ön koşullar kısa fakat tutarlı bir çerçevede yeniden kurulur." },
      { title: "Problemi yapılandır", description: "Verilenler, istenenler, kısıtlar ve uygun yöntem çözümden önce ayrıştırılır." },
      { title: "Hata üzerinden öğren", description: "Yanlış sonuç yalnızca düzeltilmez; kararın nerede koptuğu ve nasıl kontrol edileceği incelenir." },
    ],
  },
  journey: {
    eyebrow: "Öğrenci yolculuğu",
    title: "Ders takvimiyle birlikte ilerleyen sakin bir süreç.",
    intro: "Yoğunluk ve odak, öğrencinin mevcut akademik takvimine göre değişebilir.",
    steps: [
      { id: "conversation", title: "İlk görüşme", description: "Ders, hedef ve yakın takvim anlaşılır." },
      { id: "materials", title: "Materyal inceleme", description: "Syllabus, notlar ve görevler üzerinden kapsam doğrulanır." },
      { id: "plan", title: "Bireysel plan", description: "Öncelikler ve çalışma sırası belirlenir." },
      { id: "sessions", title: "Düzenli çalışma", description: "Kavram ve problem çözme birlikte yürütülür." },
      { id: "progress", title: "İlerleme kontrolü", description: "Plan yeni ihtiyaçlara göre güncellenir." },
    ],
  },
  individual: {
    eyebrow: "Neden bireysel destek?",
    title: "Aynı dersi alan iki öğrenci, aynı yerde zorlanmayabilir.",
    body: "Bireysel çalışma; öğrencinin ders bağlamını, ön bilgilerini ve hata örüntülerini merkeze alır. Amaç hazır çözüm vermek değil, öğrencinin kendi başına kullanabileceği daha güçlü bir akademik düşünme düzeni kurmaktır.",
    points: ["Derse özgü öncelik", "Öğrenci hızına uygun açıklama", "Takip edilebilir problem çözme", "Değişen takvime uyarlanabilen plan"],
  },
  faq: {
    eyebrow: "Sık sorulan sorular",
    title: "Üniversite ders desteği hakkında.",
    items: [
      { question: "Hangi üniversite dersleri için destek alabilirim?", answer: "Mevcut içerik STEM ve sayısal dersler, problem setleri, laboratuvar raporları, araştırma çalışmaları ve üniversite çalışma becerileri için genel bir destek çerçevesini doğruluyor. Belirli bir ders için uygunluk, ders izlencesi ve materyaller incelendikten sonra netleştirilir." },
      { question: "Destek yalnızca sınav dönemlerinde mi verilir?", answer: "Hayır. Haftalık ders takibi ve problem setleri için düzenli çalışma yapılabileceği gibi quiz, vize ve final öncesinde daha odaklı bir plan da oluşturulabilir." },
      { question: "Ders materyallerimi paylaşmam gerekir mi?", answer: "Syllabus, ders notları, görev yönergeleri ve yaklaşan değerlendirme kapsamı desteğin doğru yapılandırılmasına yardımcı olur. İlk aşamada hangi materyallerin gerekli olduğu birlikte belirlenir." },
      { question: "Oriens ödevimi veya raporumu benim yerime hazırlar mı?", answer: "Hayır. Destek; kavramı anlama, yapı kurma, yöntem seçme, geri bildirim ve öğrencinin kendi çalışmasını geliştirmesi üzerine kuruludur." },
      { question: "Çalışma sıklığı nasıl belirlenir?", answer: "Ders yükü, mevcut eksikler ve akademik takvim birlikte değerlendirilir. Uygun sıklık ilk görüşme ve materyal incelemesinden sonra planlanır." },
    ],
  },
  cta: {
    eyebrow: "Akademik yönünüzü netleştirin",
    title: "Zorlandığınız dersi birlikte netleştirelim.",
    body: "Dersinizin içeriğini, mevcut durumunuzu ve yakın takviminizi konuşarak uygun destek kapsamını birlikte belirleyebiliriz.",
    primary: "Ücretsiz Görüşme Planla",
    secondary: "İletişime Geç",
  },
} satisfies UniversitySupportContent;
