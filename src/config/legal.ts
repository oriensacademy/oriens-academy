export interface LegalEntityConfig {
  brandName: string;
  formalCompanyTitle: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  mersisNumber: string | null;
  tradeRegistryNumber: string | null;
  kepAddress: string | null;
  address: {
    tr: string;
    en: string;
  };
  addressLines: {
    tr: string[];
    en: string[];
  };
  whatsapp: string;
  whatsappHref: string;
  phone: string;
  phoneHref: string;
  emails: {
    info: string;
    contact: string;
    support: string;
    payments: string;
  };
}

export const LEGAL_CONFIG: LegalEntityConfig = {
  brandName: "Oriens Academy",
  formalCompanyTitle: null,
  taxOffice: null,
  taxNumber: null,
  mersisNumber: null,
  tradeRegistryNumber: null,
  kepAddress: null,
  address: {
    tr: "Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul",
    en: "Emaar Square, The Heights E Block, Ünalan Neighborhood, Libadiye Street No:82, Üsküdar / Istanbul",
  },
  addressLines: {
    tr: [
      "Emaar Square, The Heights E Blok",
      "Ünalan Mah., Libadiye Cd. No:82",
      "Üsküdar / İstanbul",
    ],
    en: [
      "Emaar Square, The Heights E Block",
      "Ünalan Neighborhood, Libadiye Street No:82",
      "Üsküdar / Istanbul",
    ],
  },
  whatsapp: "+90 544 293 90 40",
  whatsappHref: "https://wa.me/905442939040",
  phone: "0850 304 04 67",
  phoneHref: "tel:08503040467",
  emails: {
    info: "info@oriens-academy.com",
    contact: "contact@oriens-academy.com",
    support: "support@oriens-academy.com",
    payments: "payments@oriens-academy.com",
  },
};

export const LEGAL_VERSIONS = {
  salesAgreement: "2026-08-27",
  preInformation: "2026-08-27",
  refundPolicy: "2026-08-27",
  privacyPolicy: "2026-08-27",
  kvkkNotice: "2026-08-27",
  cookiePolicy: "2026-08-27",
  terms: "2026-08-27",
} as const;

export type LegalDocKey =
  | "salesAgreement"
  | "preInformation"
  | "refundPolicy"
  | "kvkk"
  | "cookie"
  | "privacy"
  | "terms";

export interface LegalDocument {
  key: LegalDocKey;
  version: string;
  lastUpdated: string;
  title: string;
  badge: string;
  intro: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
}

export const LEGAL_DOCS: Record<"tr" | "en", Record<LegalDocKey, LegalDocument>> = {
  tr: {
    salesAgreement: {
      key: "salesAgreement",
      version: LEGAL_VERSIONS.salesAgreement,
      lastUpdated: "27 Ağustos 2026",
      title: "Mesafeli Satış Sözleşmesi",
      badge: "Tüketici Sözleşmesi",
      intro:
        "İşbu Mesafeli Satış Sözleşmesi (\"Sözleşme\"), 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri uyarınca, aşağıda bilgileri yer alan Satıcı ile Alıcı arasında elektronik ortamda akdedilmiştir.",
      sections: [
        {
          heading: "1. Taraflar",
          paragraphs: [
            "SATICI: Oriens Academy (\"Satıcı\")\nAdres: Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul\nE-posta: info@oriens-academy.com / payments@oriens-academy.com\nTelefon: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
            "ALICI (\"Öğrenci/Müşteri\"): Web sitesi (oriens-academy.com) üzerinden eğitim ve sınav danışmanlığı paketi satın alan, sipariş formunda adı, soyadı, e-posta adresi ve iletişim bilgileri kayıt altına alınan gerçek veya tüzel kişi.",
          ],
        },
        {
          heading: "2. Sözleşmenin Konusu",
          paragraphs: [
            "İşbu Sözleşme'nin konusu; Alıcı'nın Satıcı'ya ait oriens-academy.com internet sitesi üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış fiyatı sipariş özetinde ve Ön Bilgilendirme Formu'nda belirtilen uluslararası eğitim danışmanlığı, sınav hazırlığı ve özel ders paketlerinin satışı ve ifası ile ilgili olarak tarafların hak ve yükümlülüklerinin belirlenmesidir.",
          ],
        },
        {
          heading: "3. Hizmet, Fiyatlandırma ve Ödeme",
          paragraphs: [
            "Satın alınan ders paketinin kapsamı, ders adedi, varsa uygulanan kupon indirimi, toplam bedel ve seçilen ödeme yöntemi (Kredi/Banka Kartı veya Banka Havalesi/EFT) ödeme aşamasında Alıcı tarafından onaylanan sipariş özetinde gösterilir.",
            "Kartlı ödemelerde tahsilat PayTR Ödeme ve Elektronik Para Kuruluşu A.Ş. güvenli altyapısı üzerinden gerçekleştirilir. Kart bilgileri Satıcı sunucularında tutulmaz.",
            "Banka havalesi/EFT ile yapılan alımlarda, sipariş Satıcı'nın banka hesabına ilgili tutar intikal edip onaylanana kadar beklemede kalır.",
          ],
        },
        {
          heading: "4. Hizmetin İfası ve Teslimat",
          paragraphs: [
            "Satın alınan paket kapsamındaki ders kredileri, ödeme onayı ile birlikte Alıcı'nın öğrenci portalı hesabına otomatik veya sistem onaylı olarak tanımlanır.",
            "Dersler ve danışmanlık oturumları, öğrenci ve eğitmen takvimine uygun olarak belirlenen saatlerde çevrim içi video konferans araçları üzerinden birebir veya grup formatında gerçekleştirilir.",
          ],
        },
        {
          heading: "5. Cayma Hakkı, İptal ve İade Esasları",
          paragraphs: [
            "Alıcı, satın aldığı ders paketine ilişkin olarak ilgili tüketici mevzuatı kapsamında belirlenen haklara sahiptir. Tamamen kullanılmamış paketlerde, mevzuata ve işbu sözleşmeye uygun bildirimle iptal ve iade talep edilebilir.",
            "Paket kapsamında bir veya daha fazla dersin kullanılmış olması halinde, iade hesabında tamamlanan dersler, satın alma sırasında kullanıcıya bildirilen indirimsiz standart tek ders liste bedeli üzerinden hesaplanır. Tamamlanan derslerin toplam bedeli müşterinin fiilen ödediği paket bedelinden mahsup edilir ve varsa kalan bakiye, uygulanabilir mevzuat ve ödeme kuruluşu/banka süreçleri çerçevesinde ödeme yöntemine uygun şekilde iade edilir. Bu hesaplama müşteriye ek borç veya negatif iade bakiyesi doğurmaz. Tüketicinin emredici mevzuattan doğan hakları saklıdır.",
          ],
        },
        {
          heading: "6. Güvenlik ve Kişisel Veriler",
          paragraphs: [
            "Alıcı'nın ödeme ve üyelik işlemleri sırasında paylaştığı kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu'na uygun olarak işlenir. Kart bilgileri PayTR'ın güvenli ödeme altyapısı üzerinden işlenir ve Oriens Academy sunucularında saklanmaz.",
          ],
        },
        {
          heading: "7. Uyuşmazlıkların Çözümü",
          paragraphs: [
            "İşbu Sözleşme'den doğabilecek uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl ilan edilen parasal sınırlar dahilinde Alıcı'nın veya Satıcı'nın yerleşim yerindeki İl veya İlçe Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir.",
          ],
        },
        {
          heading: "8. Yürürlük",
          paragraphs: [
            "Alıcı, web sitesi üzerinden siparişini tamamlamadan önce işbu Sözleşme'yi ve Ön Bilgilendirme Formu'nu okuyup elektronik ortamda onayladığını kabul, beyan ve taahhüt eder.",
          ],
        },
      ],
    },
    preInformation: {
      key: "preInformation",
      version: LEGAL_VERSIONS.preInformation,
      lastUpdated: "27 Ağustos 2026",
      title: "Ön Bilgilendirme Formu",
      badge: "Sipariş Ön Bilgilendirmesi",
      intro:
        "İşbu Ön Bilgilendirme Formu, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nin 5. maddesi uyarınca Alıcı'yı sipariş öncesinde bilgilendirmek amacıyla hazırlanmıştır.",
      sections: [
        {
          heading: "1. Satıcı Bilgileri",
          paragraphs: [
            "Unvan / Marka: Oriens Academy\nAdres: Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul\nTelefon: 0850 304 04 67 | WhatsApp: +90 544 293 90 40\nE-posta: info@oriens-academy.com / payments@oriens-academy.com",
          ],
        },
        {
          heading: "2. Hizmetin Temel Nitelikleri ve Fiyatı",
          paragraphs: [
            "Satın alınmak istenen uluslararası eğitim/sınav hazırlığı paketinin adı, ders saati adedi, geçerlilik süresi ve vergiler dahil toplam satış bedeli sipariş ekranında ve sepet özetinde Alıcı'ya açıkça gösterilmektedir.",
            "Sipariş esnasında geçerli bir kupon kodu kullanılması durumunda, indirim tutarı anlık olarak hesaplanarak ödenecek net tutara yansıtılır.",
          ],
        },
        {
          heading: "3. Ödeme ve İfa Bilgileri",
          paragraphs: [
            "Ödeme; anlaşmalı ödeme kuruluşu PayTR altyapısıyla kredi/banka kartı veya doğrudan banka havalesi/EFT yöntemiyle yapılabilir.",
            "Ödemesi başarıyla tamamlanan paketler anında veya havale onayını takiben öğrencinin hesabına tanımlanır. Dersler dijital platformlar üzerinden çevrim içi olarak ifa edilir.",
          ],
        },
        {
          heading: "4. Cayma Hakkı ve İade Koşulları Özeti",
          paragraphs: [
            "Alıcı, sözleşme konusu hizmetin ifasına başlanmamış olması kaydıyla yasal süre içerisinde cayma hakkını kullanabilir.",
            "Ders paketinin kısmen kullanılmış olması durumunda iade hesabında; tamamlanan dersler satın alma esnasında bildirilen standart tek ders liste fiyatı üzerinden hesaplanarak ödenen paket bedelinden mahsup edilir ve kalan tutar Alıcı'ya iade edilir.",
          ],
        },
        {
          heading: "5. Şikayet ve İtiraz",
          paragraphs: [
            "Alıcı, hizmete ilişkin soru, talep veya şikayetlerini support@oriens-academy.com e-posta adresine veya 0850 304 04 67 numaralı kurumsal hatta iletebilir. Uyuşmazlık halinde Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri görevlidir.",
          ],
        },
      ],
    },
    refundPolicy: {
      key: "refundPolicy",
      version: LEGAL_VERSIONS.refundPolicy,
      lastUpdated: "27 Ağustos 2026",
      title: "İptal ve İade Koşulları",
      badge: "İade Politikası",
      intro:
        "Oriens Academy olarak öğrenci memnuniyetini ve şeffaf eğitim süreçlerini esas alıyoruz. Paket satın alımlarına, ders iptallerine ve iade süreçlerine ilişkin resmi kurallar aşağıda yer almaktadır.",
      sections: [
        {
          heading: "1. Genel Esaslar",
          paragraphs: [
            "Oriens Academy üzerinden satın alınan tüm eğitim ve danışmanlık paketleri tüketici hakları mevzuatına tabidir. İade talepleri payments@oriens-academy.com adresine yazılı olarak veya öğrenci paneli destek kanalı üzerinden iletilmelidir.",
          ],
        },
        {
          heading: "2. Kullanılmamış Paketlerin İadesi",
          paragraphs: [
            "Satın alındıktan sonra hiçbir dersi kullanılmamış ve randevusu tamamlanmamış paketler için yasal süre içerisinde yapılan başvurularda, ödenen tutarın tamamı kesintisiz olarak Alıcı'nın ödeme yaptığı yöntem üzerinden iade edilir.",
          ],
        },
        {
          heading: "3. Kısmen Kullanılmış Paketlerin İade Hesabı",
          paragraphs: [
            "Paket kapsamında bir veya daha fazla dersin kullanılmış olması halinde, iade hesabında tamamlanan dersler, satın alma sırasında kullanıcıya bildirilen indirimsiz standart tek ders liste bedeli üzerinden hesaplanır. Tamamlanan derslerin toplam bedeli müşterinin fiilen ödediği paket bedelinden mahsup edilir ve varsa kalan bakiye, uygulanabilir mevzuat ve ödeme kuruluşu/banka süreçleri çerçevesinde ödeme yöntemine uygun şekilde iade edilir. Bu hesaplama müşteriye ek borç veya negatif iade bakiyesi doğurmaz. Tüketicinin emredici mevzuattan doğan hakları saklıdır.",
          ],
        },
        {
          heading: "4. Mükerrer / Hatalı Tahsilatlar",
          paragraphs: [
            "Teknik bir aksaklık veya kullanıcı hatası nedeniyle aynı paket için mükerrer tahsilat yapılması durumunda, fazla tahsil edilen tutar derhal tespit edilerek tam tutarıyla iade edilir.",
          ],
        },
        {
          heading: "5. İade Süreci ve Geri Ödeme Kanalları",
          paragraphs: [
            "Kredi veya banka kartı ile yapılan ödemelerde iade, PayTR sistemi üzerinden ödemenin yapıldığı karta iletilir. Bankaların yansıtma süreleri ilgili finans kuruluşunun süreçlerine bağlıdır.",
            "Banka havalesi/EFT ile yapılan ödemelerde iadeler, ödemeyi yapan Alıcı'nın adıyla eşleşen banka hesabına transfer edilir.",
          ],
        },
      ],
    },
    kvkk: {
      key: "kvkk",
      version: LEGAL_VERSIONS.kvkkNotice,
      lastUpdated: "27 Ağustos 2026",
      title: "KVKK Aydınlatma Metni",
      badge: "6698 Sayılı Kanun Kapsamında",
      intro:
        "Oriens Academy olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca veri sorumlusu sıfatıyla, kişisel verilerinizin güvenliğine ve gizliliğine azami hassasiyet göstermekteyiz.",
      sections: [
        {
          heading: "1. Veri Sorumlusu",
          paragraphs: [
            "Kişisel verileriniz, veri sorumlusu sıfatıyla Oriens Academy (Emaar Square, The Heights E Blok, Üsküdar / İstanbul) tarafından işlenmektedir.",
          ],
        },
        {
          heading: "2. İşlenen Kişisel Veri Kategorileri",
          paragraphs: [
            "Akademi hizmetleri kapsamında aşağıdaki veri kategorileri işlenebilmektedir:",
          ],
          bullets: [
            "Kimlik Verileri: Ad, soyad.",
            "İletişim Verileri: E-posta adresi, telefon numarası.",
            "Eğitim ve Akademik Veriler: Hedeflenen sınav (IB, AP, SAT vb.), sınıf düzeyi, ders notları, randevu ve ödev geçmişi.",
            "Finans ve İşlem Verileri: Satın alınan paket bilgisi, işlem tutarı, ödeme referans numarası, kupon kodu (Ham kart verisi veya CVV kesinlikle işlenmez/saklanmaz).",
            "İşlem Güvenliği Verileri: IP adresi, oturum giriş kayıtları, güvenlik doğrulama logları.",
          ],
        },
        {
          heading: "3. Kişisel Verilerin İşlenme Amaçları ve Hukuki Sebepleri",
          paragraphs: [
            "Kişisel verileriniz; KVKK'nın 5. maddesinde belirtilen \"bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması\", \"veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi\" ve \"meşru menfaat\" hukuki sebeplerine dayalı olarak aşağıdaki amaçlarla işlenir:",
          ],
          bullets: [
            "Eğitim danışmanlığı, seviye tespiti ve ders planlaması süreçlerinin yürütülmesi,",
            "Öğrenci portalı hesabının oluşturulması ve hesap güvenliğinin sağlanması,",
            "Ödeme, faturalandırma ve finansal mutabakat işlemlerinin gerçekleştirilmesi,",
            "Talep, soru ve destek bildirimlerinin yanıtlanması,",
            "Hukuki ve idari yükümlülüklerin yerine getirilmesi.",
          ],
        },
        {
          heading: "4. Kişisel Verilerin Aktarılması",
          paragraphs: [
            "Kişisel verileriniz, yalnızca hizmetin ifası ve yasal zorunluluklar çerçevesinde; ödeme altyapısı sağlayıcımız PayTR, veri tabanı ve kimlik doğrulama altyapısı sağlayıcımız Supabase, e-posta iletim altyapısı ve yetkili kamu kurum ve kuruluşları ile mevzuata uygun olarak paylaşılmaktadır. Verileriniz üçüncü şahıslara ticari amaçla satılmaz.",
          ],
        },
        {
          heading: "5. İlgili Kişinin Hakları (KVKK m. 11)",
          paragraphs: [
            "KVKK'nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini isteme ve silinmesini talep etme haklarına sahipsiniz.",
            "Başvurularınızı kimliğinizi teyit eden belgeler ile info@oriens-academy.com e-posta adresine iletebilirsiniz.",
          ],
        },
      ],
    },
    cookie: {
      key: "cookie",
      version: LEGAL_VERSIONS.cookiePolicy,
      lastUpdated: "27 Ağustos 2026",
      title: "Çerez Politikası",
      badge: "Çerez ve Gizlilik Tercihleri",
      intro:
        "İşbu Çerez Politikası, Oriens Academy web sitesini (oriens-academy.com) ziyaret eden kullanıcıların deneyimini geliştirmek, site güvenliğini sağlamak ve ziyaretçi istatistiklerini analiz etmek amacıyla kullanılan çerezler hakkında bilgilendirme sunar.",
      sections: [
        {
          heading: "1. Çerez Nedir?",
          paragraphs: [
            "Çerezler (Cookies), ziyaret ettiğiniz internet siteleri tarafından tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır. Çerezler web sitesinin verimli çalışmasını ve tercihlerinize uygun hizmet sunulmasını sağlar.",
          ],
        },
        {
          heading: "2. Sitemizde Kullanılan Çerez Türleri",
          paragraphs: [
            "Platformumuzda kullanılan çerezler kullanım amaçlarına göre aşağıdaki gibidir:",
          ],
          bullets: [
            "Zorunlu Çerezler: Web sitesinin temel fonksiyonlarının çalışması, oturum güvenliği ve Cloudflare Turnstile güvenlik doğrulamaları için kesinlikle gereklidir.",
            "Analitik ve Performans Çerezleri: Ziyaretçi sayılarını ve trafik kaynaklarını anonim olarak ölçümlememize (Google Analytics 4 & GTM) olanak tanır. Kullanıcının açık rızasıyla aktif hale getirilir.",
            "Pazarlama / Hedefleme Çerezleri: Kullanıcıların ilgi alanlarına uygun akademik içerik ve kampanya sunulmasını sağlar. Kullanıcının açık rızasına tabidir.",
          ],
        },
        {
          heading: "3. Çerez Tercihlerini Yönetme",
          paragraphs: [
            "Web sitemizi ilk ziyaretinizde karşınıza çıkan Çerez Tercihleri Paneli üzerinden dilediğiniz zaman tercihlerinizi özelleştirebilir, zorunlu olmayan çerezleri devre dışı bırakabilirsiniz.",
            "Ayrıca tarayıcı ayarlarınızdan çerezleri silebilir veya engelleyebilirsiniz.",
          ],
        },
      ],
    },
    privacy: {
      key: "privacy",
      version: LEGAL_VERSIONS.privacyPolicy,
      lastUpdated: "27 Ağustos 2026",
      title: "Gizlilik Politikası",
      badge: "Veri Gizliliği",
      intro:
        "Bu Gizlilik Politikası, Oriens Academy web sitesi ve dijital hizmetleri kapsamında kişisel bilgilerin nasıl toplandığını, korunduğunu ve işlendiğini açıklar.",
      sections: [
        {
          heading: "1. Genel İlke ve Kapsam",
          paragraphs: [
            "Oriens Academy, kullanıcılarının gizliliğine ve kişisel verilerinin korunmasına büyük önem verir. Detaylı veri koruma ilkelerimiz için lütfen KVKK Aydınlatma Metni sayfamızı inceleyiniz.",
          ],
        },
        {
          heading: "2. Hesap ve Öğrenci Bilgileri",
          paragraphs: [
            "Öğrenci portalı üyeliği ile birlikte profil, ders randevuları, akademik ödevler ve paket kullanım verileri yalnızca eğitim hizmetinin sunulması amacıyla işlenir. Parolalar Supabase Auth tarafından kriptografik olarak güvenle saklanır.",
          ],
        },
        {
          heading: "3. Ödeme ve Kart Güvenliği",
          paragraphs: [
            "Kart bilgileriniz PayTR’ın 256-bit SSL şifreli güvenli ödeme altyapısı üzerinden işlenir ve Oriens Academy sunucularında saklanmaz. PAN (kart numarası) ve CVV bilgileri sistemimize hiçbir zaman temas etmez.",
          ],
        },
        {
          heading: "4. İletişim ve Destek",
          paragraphs: [
            "Gizlilik politikamız veya verilerinizle ilgili her türlü soru ve başvuru için info@oriens-academy.com adresi üzerinden bizimle iletişime geçebilirsiniz.",
          ],
        },
      ],
    },
    terms: {
      key: "terms",
      version: LEGAL_VERSIONS.terms,
      lastUpdated: "27 Ağustos 2026",
      title: "Kullanım Koşulları",
      badge: "Genel Şartlar",
      intro:
        "Bu Kullanım Koşulları, Oriens Academy web sitesi (oriens-academy.com) ile sunulan eğitim ve danışmanlık hizmetlerinin genel kullanım şartlarını düzenler.",
      sections: [
        {
          heading: "1. Hizmet Kapsamı ve Genel Bilgilendirme",
          paragraphs: [
            "Oriens Academy, uluslararası lise ve üniversite sınavlarına hazırlık, özel ders ve akademik danışmanlık hizmetleri sunmaktadır. Web sitesindeki içerikler bilgilendirme amaçlıdır.",
          ],
        },
        {
          heading: "2. Öğrenci Hesapları ve Güvenlik",
          paragraphs: [
            "Öğrenci, hesabının giriş bilgilerinin gizliliğini korumakla yükümlüdür. Hesap üzerinden yapılan tüm işlemler öğrencinin sorumluluğundadır.",
          ],
        },
        {
          heading: "3. Satış, İptal ve İade Hükümleri",
          paragraphs: [
            "Web sitesi üzerinden yapılan paket satın alımlarında Mesafeli Satış Sözleşmesi ve İptal/İade Koşulları geçerlidir. Paket iadelerinde kısmen kullanılmış dersler standart tek ders liste fiyatı üzerinden mahsup edilir.",
          ],
        },
        {
          heading: "4. Fikri Mülkiyet Hakları",
          paragraphs: [
            "Oriens Academy web sitesinde yer alan tüm eğitim materyalleri, marka işaretleri, metinler, grafikler ve yazılımlar Oriens Academy'ye aittir; izinsiz çoğaltılamaz ve ticari amaçla kullanılamaz.",
          ],
        },
        {
          heading: "5. İletişim",
          paragraphs: [
            "Kullanım koşulları ile ilgili sorularınız için info@oriens-academy.com adresinden bize ulaşabilirsiniz.",
          ],
        },
      ],
    },
  },
  en: {
    salesAgreement: {
      key: "salesAgreement",
      version: LEGAL_VERSIONS.salesAgreement,
      lastUpdated: "August 27, 2026",
      title: "Distance Sales Agreement",
      badge: "Consumer Agreement",
      intro:
        "This Distance Sales Agreement (\"Agreement\") is concluded electronically between the Seller and the Buyer pursuant to Turkish Law No. 6502 on the Protection of Consumers and the Regulation on Distance Contracts.",
      sections: [
        {
          heading: "1. Parties",
          paragraphs: [
            "SELLER: Oriens Academy (\"Seller\")\nAddress: Emaar Square, The Heights E Block, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / Istanbul\nEmail: info@oriens-academy.com / payments@oriens-academy.com\nPhone: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
            "BUYER (\"Student/Customer\"): The natural or legal person who purchases educational and exam consultancy packages via oriens-academy.com and whose contact information is registered in the order summary.",
          ],
        },
        {
          heading: "2. Subject of Agreement",
          paragraphs: [
            "The subject of this Agreement is the determination of the rights and obligations of the parties regarding the electronic sale and performance of international academic consultancy, exam preparation, and tutoring packages.",
          ],
        },
        {
          heading: "3. Service, Pricing, and Payment",
          paragraphs: [
            "The package scope, lesson count, applicable coupon discounts, total price, and selected payment method (Credit/Debit Card via PayTR or Bank Transfer/EFT) are displayed and confirmed in the order summary prior to payment.",
            "Card payments are processed through the secure payment infrastructure of PayTR Payment and Electronic Money Institution. Card credentials are never stored on Seller servers.",
          ],
        },
        {
          heading: "4. Performance and Delivery",
          paragraphs: [
            "Lesson credits included in the purchased package are credited to the Buyer's student portal upon payment confirmation. Lessons are conducted live online via video conference according to mutual scheduling.",
          ],
        },
        {
          heading: "5. Right of Withdrawal, Cancellation, and Refund Policy",
          paragraphs: [
            "The Buyer holds statutory cancellation rights in accordance with consumer protection regulations. For completely unused packages, full refunds may be requested within statutory notice periods.",
            "In the event that one or more lessons have been used under the package, completed lessons are calculated based on the non-discounted standard single-lesson list price communicated at the time of purchase. The total cost of completed lessons is deducted from the actual package price paid, and any remaining balance is refunded in accordance with applicable legislation and payment institution/banking workflows. This calculation does not create additional debt or a negative refund balance for the customer. Statutory consumer rights remain reserved.",
          ],
        },
        {
          heading: "6. Security & Data Protection",
          paragraphs: [
            "Personal data provided during ordering is processed in accordance with personal data protection laws. Card information is processed through PayTR's secure payment infrastructure and is not stored on Oriens Academy servers.",
          ],
        },
        {
          heading: "7. Dispute Resolution",
          paragraphs: [
            "In disputes arising from this Agreement, Turkish Consumer Arbitration Committees and Consumer Courts within monetary jurisdictions are authorized.",
          ],
        },
        {
          heading: "8. Enforcement",
          paragraphs: [
            "By completing the electronic order, the Buyer acknowledges and accepts all terms of this Agreement and the Pre-Information Form.",
          ],
        },
      ],
    },
    preInformation: {
      key: "preInformation",
      version: LEGAL_VERSIONS.preInformation,
      lastUpdated: "August 27, 2026",
      title: "Pre-Information Form",
      badge: "Pre-Order Notice",
      intro:
        "This Pre-Information Form is provided to inform the Buyer prior to concluding a distance contract pursuant to applicable consumer protection legislation.",
      sections: [
        {
          heading: "1. Seller Information",
          paragraphs: [
            "Brand: Oriens Academy\nAddress: Emaar Square, The Heights E Block, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / Istanbul\nPhone: 0850 304 04 67 | WhatsApp: +90 544 293 90 40\nEmail: info@oriens-academy.com / payments@oriens-academy.com",
          ],
        },
        {
          heading: "2. Service Characteristics and Total Price",
          paragraphs: [
            "The package name, number of lesson hours, validity, and total all-inclusive price in TRY are clearly presented in the checkout summary prior to payment confirmation.",
          ],
        },
        {
          heading: "3. Payment & Delivery",
          paragraphs: [
            "Payments are accepted via Credit/Debit card through PayTR or via direct Bank Transfer/EFT. Purchased packages are activated electronically upon payment verification.",
          ],
        },
        {
          heading: "4. Summary of Refund Policy",
          paragraphs: [
            "For partially used packages, completed lessons are deducted at the non-discounted single-lesson list price snapshot, and the remaining net balance is refunded.",
          ],
        },
        {
          heading: "5. Inquiries & Complaints",
          paragraphs: [
            "For any inquiries, contact support@oriens-academy.com or call 0850 304 04 67.",
          ],
        },
      ],
    },
    refundPolicy: {
      key: "refundPolicy",
      version: LEGAL_VERSIONS.refundPolicy,
      lastUpdated: "August 27, 2026",
      title: "Cancellation & Refund Policy",
      badge: "Refund Terms",
      intro:
        "At Oriens Academy, we uphold academic excellence and customer satisfaction. Below are our transparent cancellation and refund rules.",
      sections: [
        {
          heading: "1. General Principles",
          paragraphs: [
            "All educational and tutoring packages purchased through Oriens Academy are subject to consumer protection standards. Refund requests should be submitted in writing to payments@oriens-academy.com.",
          ],
        },
        {
          heading: "2. Completely Unused Packages",
          paragraphs: [
            "For packages where no lessons have taken place, a 100% full refund is issued upon request within statutory notice periods.",
          ],
        },
        {
          heading: "3. Partially Used Package Refund Calculation",
          paragraphs: [
            "In the event that one or more lessons have been used under the package, completed lessons are calculated based on the non-discounted standard single-lesson list price communicated at the time of purchase. The total cost of completed lessons is deducted from the actual package price paid, and any remaining balance is refunded in accordance with applicable legislation and payment institution/banking workflows. This calculation does not create additional debt or a negative refund balance for the customer. Statutory consumer rights remain reserved.",
          ],
        },
        {
          heading: "4. Duplicate or Erroneous Charges",
          paragraphs: [
            "In the event of accidental duplicate payments, the surplus charge is verified and promptly refunded in full.",
          ],
        },
        {
          heading: "5. Refund Channels & Timelines",
          paragraphs: [
            "Card refunds are credited back to the original card via PayTR. Bank transfer refunds are remitted to the verified bank account belonging to the purchasing student/payer.",
          ],
        },
      ],
    },
    kvkk: {
      key: "kvkk",
      version: LEGAL_VERSIONS.kvkkNotice,
      lastUpdated: "August 27, 2026",
      title: "Personal Data (KVKK) Notice",
      badge: "Data Protection Notice",
      intro:
        "Oriens Academy acts as the data controller regarding personal data processed through our academic consultancy and online learning platform.",
      sections: [
        {
          heading: "1. Data Controller",
          paragraphs: [
            "Your personal data is processed by Oriens Academy (Emaar Square, The Heights E Block, Üsküdar / Istanbul).",
          ],
        },
        {
          heading: "2. Categories of Processed Data",
          paragraphs: [
            "We may process the following data categories:",
          ],
          bullets: [
            "Identity: Full name.",
            "Contact: Email address, telephone number.",
            "Academic: Target examination (IB, AP, SAT), grade level, tutoring notes, appointments.",
            "Financial & Transaction: Purchased package, paid amount, payment reference (No raw PAN/CVV card data is ever collected or stored).",
            "Technical & Security: IP address, access logs, Cloudflare Turnstile verification signals.",
          ],
        },
        {
          heading: "3. Purposes and Legal Grounds for Processing",
          paragraphs: [
            "Data is processed under contract performance, statutory compliance, and legitimate interest for educational service delivery, student portal access, secure payment processing, and support fulfillment.",
          ],
        },
        {
          heading: "4. Data Transfers",
          paragraphs: [
            "Data is transferred only to trusted infrastructure providers (PayTR for payments, Supabase for authentication/database, email service providers) strictly as necessary. Data is never sold to third parties.",
          ],
        },
        {
          heading: "5. Your Rights",
          paragraphs: [
            "You have the right to request access, rectification, or deletion of your personal data by contacting info@oriens-academy.com.",
          ],
        },
      ],
    },
    cookie: {
      key: "cookie",
      version: LEGAL_VERSIONS.cookiePolicy,
      lastUpdated: "August 27, 2026",
      title: "Cookie Policy",
      badge: "Cookies & Preferences",
      intro:
        "This Cookie Policy explains how Oriens Academy uses cookies and similar technologies on oriens-academy.com.",
      sections: [
        {
          heading: "1. What are Cookies?",
          paragraphs: [
            "Cookies are small text files stored on your device that enable website security, session persistence, and traffic measurement.",
          ],
        },
        {
          heading: "2. Cookie Categories",
          paragraphs: [
            "We categorize cookies into:",
          ],
          bullets: [
            "Necessary & Security: Essential for website operation, session integrity, and Turnstile bot protection.",
            "Analytics: Enables anonymous aggregated measurement of website visits (Google Analytics 4 & GTM) based on your consent.",
            "Marketing: Used for relevant academic content delivery subject to your explicit consent.",
          ],
        },
        {
          heading: "3. Managing Your Preferences",
          paragraphs: [
            "You can manage your cookie preferences at any time through our Cookie Preferences banner or your web browser settings.",
          ],
        },
      ],
    },
    privacy: {
      key: "privacy",
      version: LEGAL_VERSIONS.privacyPolicy,
      lastUpdated: "August 27, 2026",
      title: "Privacy Policy",
      badge: "Privacy Overview",
      intro:
        "This Privacy Policy outlines how Oriens Academy collects and safeguards personal information across our website and educational services.",
      sections: [
        {
          heading: "1. Principles & KVKK Compliance",
          paragraphs: [
            "Oriens Academy is committed to data privacy. For detailed information regarding our data processing principles, please review our Personal Data (KVKK) Notice.",
          ],
        },
        {
          heading: "2. Student Portal & Accounts",
          paragraphs: [
            "Student portal records (appointments, homework, package balance) are processed solely for educational delivery. Passwords are cryptographically managed via Supabase Auth.",
          ],
        },
        {
          heading: "3. Payment Security",
          paragraphs: [
            "Your card information is processed through PayTR's secure payment infrastructure and is not stored on Oriens Academy servers.",
          ],
        },
        {
          heading: "4. Contact",
          paragraphs: [
            "For inquiries regarding privacy, please contact info@oriens-academy.com.",
          ],
        },
      ],
    },
    terms: {
      key: "terms",
      version: LEGAL_VERSIONS.terms,
      lastUpdated: "August 27, 2026",
      title: "Terms of Service",
      badge: "General Terms",
      intro:
        "These Terms of Service govern your use of the Oriens Academy website (oriens-academy.com) and associated academic tutoring services.",
      sections: [
        {
          heading: "1. Scope of Service",
          paragraphs: [
            "Oriens Academy provides international curriculum tutoring, exam preparation, and academic consultancy.",
          ],
        },
        {
          heading: "2. Student Accounts",
          paragraphs: [
            "Users are responsible for maintaining account confidentiality and providing accurate information.",
          ],
        },
        {
          heading: "3. Sales, Cancellation, and Refunds",
          paragraphs: [
            "Purchases are governed by our Distance Sales Agreement and Cancellation & Refund Policy. Partial package refunds deduct completed lessons at the non-discounted single-lesson list price.",
          ],
        },
        {
          heading: "4. Intellectual Property",
          paragraphs: [
            "All website materials, marks, and educational content are the intellectual property of Oriens Academy.",
          ],
        },
        {
          heading: "5. Inquiries",
          paragraphs: [
            "For questions regarding our terms, reach us at info@oriens-academy.com.",
          ],
        },
      ],
    },
  },
};
