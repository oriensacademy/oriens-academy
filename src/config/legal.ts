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
    en: "Emaar Square, The Heights E Block, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / Istanbul",
  },
  addressLines: {
    tr: [
      "Emaar Square, The Heights E Blok",
      "Ünalan Mah., Libadiye Cd. No:82",
      "Üsküdar / İstanbul",
    ],
    en: [
      "Emaar Square, The Heights E Block",
      "Ünalan Mah., Libadiye Cd. No:82",
      "Üsküdar / Istanbul",
    ],
  },
  whatsapp: "+90 544 293 90 40",
  whatsappHref: "https://wa.me/905442939040",
  phone: "0850 304 04 67",
  phoneHref: "tel:08503040467",
  emails: {
    info: "info@oriens-academy.com",
    contact: "info@oriens-academy.com",
    support: "info@oriens-academy.com",
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
      badge: "Hizmet Sözleşmesi",
      intro:
        "İşbu Mesafeli Satış Sözleşmesi (\"Sözleşme\"), 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri uyarınca, aşağıda bilgileri yer alan Hizmet Sağlayıcı ile Alıcı/Hizmet Alan arasında elektronik ortamda akdedilmiştir.",
      sections: [
        {
          heading: "1. Taraflar",
          paragraphs: [
            "HİZMET SAĞLAYICI: Oriens Academy\nWeb Sitesi: https://oriens-academy.com\nAdres: Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul\nGenel E-posta: info@oriens-academy.com | Ödeme/Muhasebe: payments@oriens-academy.com\nTelefon: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
            "ALICI / HİZMET ALAN: Oriens Academy web sitesi (oriens-academy.com) üzerinden çevrim içi eğitim, sınav hazırlığı veya akademik danışmanlık hizmeti satın alan, sipariş/ödeme aşamasında bilgilerini sisteme giren veya kayıtlı kullanıcı hesabını kullanan gerçek veya tüzel kişidir.",
          ],
        },
        {
          heading: "2. Sözleşmenin Konusu",
          paragraphs: [
            "İşbu Sözleşme'nin konusu; Alıcı'nın Hizmet Sağlayıcı'ya ait oriens-academy.com internet sitesi üzerinden elektronik ortamda siparişini verdiği, nitelikleri ve satış bedeli sipariş özetinde ve Ön Bilgilendirme Formu'nda belirtilen uluslararası eğitim, sınav hazırlığı ve akademik danışmanlık hizmet paketlerinin satışı ve ifasına ilişkin tarafların hak ve yükümlülüklerinin düzenlenmesidir.",
          ],
        },
        {
          heading: "3. Satın Alınan Hizmet ve Kapsamı",
          paragraphs: [
            "Sözleşme konusu hizmet; SAT, IB, AP, ESAT, TMUA, IGCSE, GRE, GMAT, UCAT, IMAT gibi uluslararası akademik sınavlara hazırlık ve yurt dışı üniversite kabul süreçlerine yönelik bire bir veya grup çevrim içi özel ders, deneme sınavı değerlendirmesi ve mentorluk oturumlarını kapsar.",
          ],
        },
        {
          heading: "4. Paket ve Ders Bilgileri",
          paragraphs: [
            "Satın alınan ders paketinin türü, ders saati adedi, geçerlilik süresi ve temel nitelikleri sipariş anında Alıcı'ya sunulan ve elektronik ortamda teyit edilen Sipariş Özeti'nde ve Ön Bilgilendirme Formu'nda açıkça gösterilmektedir.",
          ],
        },
        {
          heading: "5. Toplam Ödeme Tutarı",
          paragraphs: [
            "Hizmet bedeli; seçilen paketin liste fiyatı, varsa uygulanan indirim veya kupon düşüldükten sonra kalan nihai toplam tutardır. Tüm vergiler ve işlem bedelleri toplam tutara dahildir.",
          ],
        },
        {
          heading: "6. İndirimler ve Kampanyalar",
          paragraphs: [
            "Kullanılan indirim kuponları veya promosyonlar sipariş anında doğrulanır ve toplam fiyattan düşülür. İndirim koşulları yalnızca tanımlandığı paket ve süre için geçerlidir.",
          ],
        },
        {
          heading: "7. Ödeme Yöntemleri",
          paragraphs: [
            "Ödemeler, internet sitesi üzerinden PayTR güvenli ödeme altyapısı aracılığıyla kredi kartı veya banka kartı ile gerçekleştirilebilir.",
          ],
        },
        {
          heading: "8. PayTR ile Güvenli Kart Ödemesi",
          paragraphs: [
            "Kredi kartı ve banka kartı işlemleri, TCMB ve BDDK lisanslı PayTR Ödeme ve Elektronik Para Kuruluşu A.Ş. güvenli ödeme altyapısı üzerinden 256-bit SSL şifreleme ve 3D Secure doğrulaması ile gerçekleştirilir. Kart bilgileri hiçbir surette Oriens Academy sunucularında tutulmaz ve işlenmez.",
          ],
        },
        {
          heading: "10. Hizmetin Sunulması ve İfası",
          paragraphs: [
            "Ödemenin başarıyla tamamlanmasını müteakip ders kredileri Alıcı'nın öğrenci portalına tanımlanır. Hizmet, Alıcı ile mutabık kalınan gün ve saatlerde çevrim içi video konferans platformları üzerinden ifa edilir.",
          ],
        },
        {
          heading: "11. Derslerin Planlanması ve İletişim",
          paragraphs: [
            "Ders oturumlarının takvimi, öğrenci yönetim paneli veya yetkili akademik koordinatörler aracılığıyla organize edilir. Taraflar planlanan ders saatlerine uymakla yükümlüdür.",
          ],
        },
        {
          heading: "12. İptal, İade ve Cayma Esasları",
          paragraphs: [
            "Alıcı, hizmete ilişkin yasal mevzuat kapsamındaki haklarını kullanabilir. Paket kapsamında henüz hiçbir ders oturumu gerçekleştirilmemişse, mevzuat çerçevesinde tam iade talep edilebilir.",
          ],
        },
        {
          heading: "13. Kullanılmış Derslerin İade Hesabı",
          paragraphs: [
            "Paket kapsamında bir veya daha fazla dersin kullanılmış olması halinde, iade hesabında tamamlanan dersler, satın alma sırasında kullanıcıya bildirilen indirimsiz standart tek ders liste bedeli üzerinden hesaplanır.",
            "Tamamlanan derslerin toplam bedeli, müşterinin paket için fiilen ödediği toplam tutardan mahsup edilir.",
            "Mahsup sonrasında kalan bir bakiye bulunması halinde bu bakiye, uygulanabilir mevzuat ile banka veya ödeme kuruluşunun işlem süreçleri çerçevesinde, ödemenin gerçekleştirildiği yönteme uygun şekilde iade edilir.",
            "Bu hesaplama hiçbir durumda müşteriye ek borç veya negatif iade bakiyesi doğurmaz.",
          ],
        },
        {
          heading: "14. Yasal Tüketici Hakları",
          paragraphs: [
            "Yürürlükteki mevzuattan doğan tüketici hakları saklıdır. Hizmet Sağlayıcı, mevzuata ve dürüstlük kuralına uygun olarak tüketici memnuniyetini esas alır.",
          ],
        },
        {
          heading: "15. İletişim ve Destek Kanalları",
          paragraphs: [
            "Hizmet sürecine, faturalandırmaya veya ders planlamasına ilişkin tüm soru ve bildirimler için info@oriens-academy.com, payments@oriens-academy.com e-posta adresleri veya 0850 304 04 67 numaralı kurumsal hat üzerinden Hizmet Sağlayıcı'ya ulaşılabilir.",
          ],
        },
        {
          heading: "16. Uyuşmazlıkların Çözümü",
          paragraphs: [
            "İşbu Sözleşme'den doğabilecek uyuşmazlıklarda, Ticaret Bakanlığı'nca ilan edilen parasal sınırlar dahilinde Alıcı'nın yerleşim yerindeki veya tüketici işleminin yapıldığı yerdeki Tüketici Hakem Heyetleri ile Tüketici Mahkemeleri yetkilidir.",
          ],
        },
        {
          heading: "17. Elektronik Onay ve Yürürlük",
          paragraphs: [
            "Alıcı, internet sitesi üzerinden siparişi tamamlamadan önce işbu Sözleşme'nin tüm maddelerini okuduğunu, anladığını ve elektronik ortamda onaylayarak kabul ettiğini beyan eder. Sözleşme, ödemenin onaylandığı an itibarıyla yürürlüğe girer.",
          ],
        },
      ],
    },
    preInformation: {
      key: "preInformation",
      version: LEGAL_VERSIONS.preInformation,
      lastUpdated: "27 Ağustos 2026",
      title: "Ön Bilgilendirme Formu",
      badge: "Sipariş Öncesi Bilgilendirme",
      intro:
        "İşbu Ön Bilgilendirme Formu, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, Alıcı'nın siparişini onaylamasından önce bilgilendirilmesi amacıyla hazırlanmıştır.",
      sections: [
        {
          heading: "1. Hizmet Sağlayıcı Bilgileri",
          paragraphs: [
            "Hizmet Sağlayıcı: Oriens Academy\nWeb Sitesi: https://oriens-academy.com\nAdres: Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul\nE-posta: info@oriens-academy.com / payments@oriens-academy.com\nTelefon: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
          ],
        },
        {
          heading: "2. Hizmetin Temel Nitelikleri ve Fiyatı",
          paragraphs: [
            "Satın alınan eğitim veya danışmanlık paketinin adı, ders saati adedi, liste fiyatı, uygulanan indirim ve vergiler dahil ödenecek toplam tutar sipariş onay ekranında ve özet tablosunda açıkça belirtilmektedir.",
          ],
        },
        {
          heading: "3. Ödeme ve İfa Esasları",
          paragraphs: [
            "Ödeme, kredi kartı veya banka kartı ile PayTR 256-bit SSL şifreli güvenli altyapısı üzerinden gerçekleştirilir. Ödeme onaylandığında ders hakları seçilen öğrenci hesabına aktarılır.",
          ],
        },
        {
          heading: "4. Cayma ve İade Bilgilendirmesi",
          paragraphs: [
            "Alıcı, hizmete ilişkin mevzuattan doğan haklarını kullanabilir. Paket kapsamında ders kullanımı başlamadan önce tam iade talep edilebilir. Ders kullanımı gerçekleşmiş paketlerde ise İptal ve İade Koşulları'nda yer alan mahsup hesabı uygulanır.",
          ],
        },
        {
          heading: "5. İade Mahsup Kuralı",
          paragraphs: [
            "Paket kapsamında bir veya daha fazla dersin kullanılmış olması halinde, iade hesabında tamamlanan dersler, satın alma sırasında bildirilen indirimsiz standart tek ders liste bedeli üzerinden hesaplanarak fiilen ödenen tutardan düşülür. Kalan tutar Alıcı'ya iade edilir.",
            "Yürürlükteki mevzuattan doğan tüketici hakları saklıdır.",
          ],
        },
        {
          heading: "6. Şikayet ve İtiraz",
          paragraphs: [
            "Tüketiciler, şikayet ve itirazları konusunda başvurularını yasal parasal sınırlar dahilinde Tüketici Hakem Heyetlerine veya Tüketici Mahkemelerine yapabilirler.",
          ],
        },
      ],
    },
    refundPolicy: {
      key: "refundPolicy",
      version: LEGAL_VERSIONS.refundPolicy,
      lastUpdated: "27 Ağustos 2026",
      title: "İptal ve İade Koşulları",
      badge: "Tüketici İade Politikası",
      intro:
        "Oriens Academy olarak, sunduğumuz uluslararası sınav hazırlığı ve akademik danışmanlık hizmetlerinde şeffaf, adil ve mevzuata uygun bir iptal ve iade süreci işletmekteyiz.",
      sections: [
        {
          heading: "1. Hizmet Başlamadan Önce İptal",
          paragraphs: [
            "Satın alınan eğitim paketi kapsamında henüz hiçbir ders oturumu gerçekleştirilmemişse, Alıcı sözleşme tarihinden itibaren yasal süreler içerisinde herhangi bir gerekçe göstermeksizin iptal ve tam iade talebinde bulunabilir.",
          ],
        },
        {
          heading: "2. Kısmen Kullanılmış Paketlerde İade Hesabı",
          paragraphs: [
            "Paket kapsamında bir veya daha fazla dersin kullanılmış olması halinde, iade hesabında tamamlanan dersler, satın alma sırasında kullanıcıya bildirilen indirimsiz standart tek ders liste bedeli üzerinden hesaplanır.",
            "Tamamlanan derslerin toplam bedeli, müşterinin paket için fiilen ödediği toplam tutardan mahsup edilir.",
            "Mahsup sonrasında kalan bir bakiye bulunması halinde bu bakiye, uygulanabilir mevzuat ile banka veya ödeme kuruluşunun işlem süreçleri çerçevesinde, ödemenin gerçekleştirildiği yönteme uygun şekilde iade edilir.",
            "Bu hesaplama hiçbir durumda müşteriye ek borç veya negatif iade bakiyesi doğurmaz.",
            "Yürürlükteki mevzuattan doğan tüketici hakları saklıdır.",
          ],
        },
        {
          heading: "3. Örnek İade Hesaplaması",
          paragraphs: [
            "Aşağıdaki örnek, kuralın işleyişini açıklamak amacıyla hazırlanmış bilgilendirme amaçlı bir örnek hesaplamadır (Gerçek iadelerde sipariş anındaki kayıtlı snapshot değerleri esas alınır):",
          ],
          bullets: [
            "Paket için fiilen ödenen tutar: 27.000 TL",
            "Satın alma tarihindeki indirimsiz standart tek ders liste bedeli: 3.200 TL",
            "Tamamlanan / kullanılan ders adedi: 3 ders",
            "Ders kullanım bedeli (3 × 3.200 TL): 9.600 TL",
            "İade edilebilir kalan tutar (27.000 TL - 9.600 TL): 17.400 TL",
          ],
        },
        {
          heading: "4. İade Süreci ve Geri Ödeme Şekli",
          paragraphs: [
            "İade talepleri payments@oriens-academy.com e-posta adresine yazılı olarak iletilir. İncelenen ve onaylanan iadeler, ödemenin yapıldığı karta veya banka hesabına, bankacılık ve ödeme kuruluşu işlem süreleri dahilinde aktarılır.",
          ],
        },
        {
          heading: "5. İletişim",
          paragraphs: [
            "İptal, iade ve muhasebe süreçlerine dair tüm destek talepleriniz için payments@oriens-academy.com veya 0850 304 04 67 numaralı destek hattımız üzerinden Hizmet Sağlayıcı'ya ulaşabilirsiniz.",
          ],
        },
      ],
    },
    kvkk: {
      key: "kvkk",
      version: LEGAL_VERSIONS.kvkkNotice,
      lastUpdated: "27 Ağustos 2026",
      title: "KVKK Aydınlatma Metni",
      badge: "Kişisel Verilerin Korunması",
      intro:
        "Oriens Academy (\"Hizmet Sağlayıcı\") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca, veri sorumlusu sıfatıyla kişisel verilerinizin güvenliğine ve gizliliğine azami önem veriyoruz.",
      sections: [
        {
          heading: "1. Veri Sorumlusu",
          paragraphs: [
            "Hizmet Sağlayıcı: Oriens Academy\nAdres: Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul\nİletişim E-posta: info@oriens-academy.com | Destek: info@oriens-academy.com\nTelefon: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
          ],
        },
        {
          heading: "2. İşlenen Kişisel Veriler",
          paragraphs: [
            "Kimlik bilgileri (ad, soyad) ve iletişim bilgileri (e-posta) hesap oluşturma ve iletişim süreçlerinde işlenir. Telefon numarası genel bir profil/iletişim bilgisi olarak toplanmaz; yalnızca kart ile ödeme yapıldığında ilgili işleme özel 3D Secure doğrulaması için istenir ve öğrenci/hesap profiline kaydedilmez. Ayrıca müşteri işlem ve sipariş verileri, öğrenci eğitim takip ve değerlendirme verileri ile web sitesi kullanım/log kayıtları işlenmektedir.",
          ],
        },
        {
          heading: "3. Kişisel Verilerin İşlenme Amaçları",
          paragraphs: [
            "Kişisel verileriniz; eğitim ve danışmanlık hizmetlerinin sunulması, ders planlamalarının yapılması, sipariş ve ödeme süreçlerinin yönetilmesi, yasal yükümlülüklerin yerine getirilmesi ve müşteri destek süreçlerinin yürütülmesi amaçlarıyla işlenir.",
          ],
        },
        {
          heading: "4. Verilerin Aktarılması",
          paragraphs: [
            "Kişisel verileriniz, yalnızca hizmetin gerektirdiği ölçüde yetkili kamu kurumlarına; ödeme altyapısı sağlayıcımız PayTR'a; kimlik doğrulama, veritabanı ve uygulama altyapısı için Supabase'e; işlemsel e-postaların gönderimi için Google Workspace'e; ve web sitesi güvenliği ile bot/istismar önleme amacıyla Cloudflare (Turnstile) hizmetine aktarılabilmektedir.",
          ],
        },
        {
          heading: "5. İlgili Kişinin Hakları (Madde 11) ve Hesap Silme",
          paragraphs: [
            "KVKK'nın 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işlenme amacına uygun kullanılıp kullanılmadığını öğrenme, eksik/yanlış verilerin düzeltilmesini ve silinmesini isteme haklarına sahipsiniz.",
            "Öğrenci panelinizden \"Üyeliğimi Sil\" seçeneğiyle hesabınızı doğrudan silme/anonimleştirme talebinde bulunabilirsiniz. Aktif ders hakkı, yaklaşan ders veya devam eden bir ödeme/iade işlemi bulunmadığı sürece kimlik bilgileriniz silinir veya geri döndürülemez şekilde anonimleştirilir. Kanunen saklanması zorunlu mali/hukuki kayıtlar (ör. ödeme işlemleri) ise ilgili mevzuatta öngörülen süre boyunca ayrıca ve kimliğinizden bağımsız olarak saklanmaya devam eder.",
            "Taleplerinizi info@oriens-academy.com e-posta adresine iletebilirsiniz.",
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
        "Oriens Academy web sitesi (oriens-academy.com), ziyaretçilerimizin kullanıcı deneyimini geliştirmek ve güvenli bir gezinme ortamı sunmak amacıyla çerezler (cookies) kullanmaktadır.",
      sections: [
        {
          heading: "1. Çerez Nedir?",
          paragraphs: [
            "Çerezler, bir web sitesini ziyaret ettiğinizde cihazınıza kaydedilen küçük metin dosyalarıdır. Tercihlerinizin hatırlanmasına ve sitenin güvenli çalışmasına yardımcı olur.",
          ],
        },
        {
          heading: "2. Kullanılan Çerez Türleri",
          paragraphs: [
            "Sitemizde zorunlu çerezler (oturum açma, güvenlik, sepet/ödeme işlemleri) ile kullanıcı onayına tabi analitik ve tercih çerezleri kullanılmaktadır.",
          ],
        },
        {
          heading: "3. Çerez Yönetimi ve Tercihler",
          paragraphs: [
            "Ziyaretçilerimiz web sitemizde yer alan çerez bildirim paneli veya tarayıcı ayarları üzerinden diledikleri zaman çerez tercihlerini güncelleyebilir veya engelleyebilirler.",
          ],
        },
      ],
    },
    privacy: {
      key: "privacy",
      version: LEGAL_VERSIONS.privacyPolicy,
      lastUpdated: "27 Ağustos 2026",
      title: "Gizlilik Politikası",
      badge: "Gizlilik ve Veri Güvenliği",
      intro:
        "Oriens Academy, kullanıcılarının ve öğrencilerinin gizliliğini korumayı temel ilke olarak kabul eder. Bu politika, sitemizi ziyaret ettiğinizde veya hizmetlerimizden faydalandığınızda verilerinizin nasıl korunduğunu açıklar.",
      sections: [
        {
          heading: "1. Bilgi Toplama ve Kullanım",
          paragraphs: [
            "Sitemiz üzerinden hesap oluşturma sürecinde adınız ve e-posta adresiniz gibi temel bilgiler toplanır. Bu bilgiler sadece eğitim hizmetinizin ifası için kullanılır. Telefon numaranız genel bir profil bilgisi olarak istenmez; yalnızca kart ile ödeme yaptığınızda o işleme özel 3D Secure doğrulaması için sorulur ve hesap/öğrenci profilinize kaydedilmez.",
          ],
        },
        {
          heading: "2. Ödeme Bilgilerinin Güvenliği",
          paragraphs: [
            "Kredi kartı ve banka kartı ödemeleri lisanslı ödeme kuruluşu PayTR'ın 256-bit SSL şifreli ve 3D Secure korumalı altyapısı üzerinden gerçekleştirilir. Kart bilgileriniz hiçbir şekilde sunucularımızda kaydedilmez.",
          ],
        },
        {
          heading: "3. Üçüncü Taraf Entegrasyonları",
          paragraphs: [
            "Hizmet sunumu için gerekli olan güvenli altyapı sağlayıcıları (kimlik doğrulama ve veritabanı için Supabase, ödeme için PayTR, işlemsel e-postalar için Google Workspace, ders takvimi/görüşme için Google Takvim/Meet, güvenlik ve bot önleme için Cloudflare Turnstile) haricinde verileriniz üçüncü taraflarla paylaşılmaz veya ticari amaçla satılmaz.",
          ],
        },
        {
          heading: "4. Hesap Silme ve Veri Saklama",
          paragraphs: [
            "Öğrenci panelinizden hesabınızı doğrudan silebilir veya anonimleştirebilirsiniz. Aktif ders hakkı, yaklaşan ders ya da devam eden bir ödeme/iade işlemi bulunmadığı sürece kişisel profil bilgileriniz silinir ya da geri döndürülemez şekilde anonimleştirilir. Ödeme işlemleri gibi kanunen saklanması zorunlu mali/hukuki kayıtlar, kimliğinizden bağımsız olarak ve ilgili mevzuatta öngörülen süre boyunca ayrıca saklanır.",
          ],
        },
        {
          heading: "5. İletişim",
          paragraphs: [
            "Gizlilik politikamızla ilgili tüm sorularınız için info@oriens-academy.com adresinden bize ulaşabilirsiniz.",
          ],
        },
      ],
    },
    terms: {
      key: "terms",
      version: LEGAL_VERSIONS.terms,
      lastUpdated: "27 Ağustos 2026",
      title: "Kullanım Koşulları",
      badge: "Site Kullanım Şartları",
      intro:
        "Oriens Academy web sitesini (oriens-academy.com) ziyaret ederek veya hizmetlerimizden yararlanarak işbu Kullanım Koşulları'nı kabul etmiş sayılırsınız.",
      sections: [
        {
          heading: "1. Hizmetlerin Kapsamı",
          paragraphs: [
            "Oriens Academy, uluslararası akademik sınavlara hazırlık ve üniversite kabul danışmanlığı alanında çevrim içi eğitim hizmetleri sunar.",
          ],
        },
        {
          heading: "2. Fikri Mülkiyet Hakları",
          paragraphs: [
            "Web sitesinde yer alan tüm metinler, tasarımlar, logolar, ders içerikleri ve materyaller Oriens Academy'ye aittir ve telif hakları mevzuatı ile korunmaktadır. İzinsiz kopyalanamaz veya çoğaltılamaz.",
          ],
        },
        {
          heading: "3. Bağlantılı Yasal Belgeler",
          paragraphs: [
            "Hizmet alımı ve site kullanımı sırasında geçerli olan diğer sözleşme ve politikalarımıza aşağıdaki bağlantılardan ulaşabilirsiniz:",
          ],
          bullets: [
            "Mesafeli Satış Sözleşmesi (/tr/mesafeli-satis-sozlesmesi)",
            "Ön Bilgilendirme Formu (/tr/on-bilgilendirme-formu)",
            "İptal ve İade Koşulları (/tr/iptal-ve-iade-kosullari)",
            "KVKK Aydınlatma Metni (/tr/kvkk-aydinlatma-metni)",
            "Gizlilik Politikası (/tr/privacy)",
            "Çerez Politikası (/tr/cerez-politikasi)",
          ],
        },
        {
          heading: "4. İletişim",
          paragraphs: [
            "Kullanım koşullarına dair bildirimleriniz için info@oriens-academy.com e-posta adresi veya 0850 304 04 67 destek hattımız üzerinden Hizmet Sağlayıcı'ya ulaşabilirsiniz.",
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
      badge: "Service Agreement",
      intro:
        "This Distance Sales Agreement (\"Agreement\") has been concluded electronically between the Service Provider and the Buyer / Service Recipient in accordance with consumer protection regulations.",
      sections: [
        {
          heading: "1. Parties",
          paragraphs: [
            "SERVICE PROVIDER: Oriens Academy\nWebsite: https://oriens-academy.com\nAddress: Emaar Square, The Heights E Block, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / Istanbul\nEmail: info@oriens-academy.com / payments@oriens-academy.com\nPhone: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
            "BUYER / SERVICE RECIPIENT: The individual or legal entity purchasing online academic tutoring, exam preparation, or admissions advisory packages on oriens-academy.com whose contact and billing details are registered during checkout or within their student account.",
          ],
        },
        {
          heading: "2. Subject of the Agreement",
          paragraphs: [
            "The subject of this Agreement is the determination of rights and obligations regarding the sale and delivery of online exam preparation, tutoring, and academic consulting packages ordered electronically by the Buyer on oriens-academy.com.",
          ],
        },
        {
          heading: "3. Scope of Service",
          paragraphs: [
            "The services covered encompass one-on-one or group online lessons, mock exam assessments, and mentorship sessions for international exams including SAT, IB, AP, ESAT, TMUA, IGCSE, GRE, GMAT, UCAT, IMAT, and global university admissions.",
          ],
        },
        {
          heading: "4. Package and Lesson Information",
          paragraphs: [
            "The package type, total lesson hours, validity, and features are clearly specified in the Order Summary and Pre-Information Form confirmed by the Buyer prior to purchase.",
          ],
        },
        {
          heading: "5. Total Payment Amount",
          paragraphs: [
            "The total payable amount is the final price calculated after deducting applicable discounts and coupons from the package list price. All applicable taxes and service fees are included.",
          ],
        },
        {
          heading: "6. Discounts and Coupons",
          paragraphs: [
            "Discounts and promotional codes are validated at checkout and deducted from the payable total. Promotional conditions apply only to the designated package and time frame.",
          ],
        },
        {
          heading: "7. Payment Methods",
          paragraphs: [
            "Payments can be made by credit or debit card through PayTR's secure payment infrastructure on the official platform.",
          ],
        },
        {
          heading: "8. Secure Card Payment via PayTR",
          paragraphs: [
            "Card payments are processed securely through PayTR Payment and Electronic Money Institution infrastructure with 256-bit SSL encryption and mandatory 3D Secure verification. Card credentials are never stored on Oriens Academy servers.",
          ],
        },
        {
          heading: "10. Service Delivery",
          paragraphs: [
            "Upon successful payment, lesson credits are allocated to the student portal. Sessions are conducted online via video conferencing platforms at mutually agreed schedules.",
          ],
        },
        {
          heading: "11. Scheduling and Attendance",
          paragraphs: [
            "Lesson scheduling is coordinated through the student dashboard or assigned academic coordinators. Both parties commit to adhering to scheduled class timings.",
          ],
        },
        {
          heading: "12. Cancellation and Refund Principles",
          paragraphs: [
            "The Buyer is entitled to statutory consumer rights. If no lesson sessions have commenced, a full refund may be requested within statutory cancellation windows.",
          ],
        },
        {
          heading: "13. Refund Calculation for Utilized Lessons",
          paragraphs: [
            "If one or more lessons have already been completed under a package, completed lessons are calculated and deducted based on the undiscounted standard single-lesson list price communicated at purchase time.",
            "The total cost of completed lessons is deducted from the actual total amount paid by the customer for the package.",
            "Any remaining positive balance is refunded to the original payment method in accordance with applicable regulations and payment processor settlement cycles.",
            "This calculation shall under no circumstances generate additional debt or a negative balance for the customer.",
          ],
        },
        {
          heading: "14. Statutory Consumer Rights",
          paragraphs: [
            "All consumer rights arising under applicable legislation are fully preserved and respected.",
          ],
        },
        {
          heading: "15. Contact and Support",
          paragraphs: [
            "For billing, scheduling, or service inquiries, you can reach the Service Provider via info@oriens-academy.com, payments@oriens-academy.com, or 0850 304 04 67.",
          ],
        },
        {
          heading: "16. Dispute Resolution",
          paragraphs: [
            "Disputes arising from this Agreement shall be submitted to Consumer Arbitration Committees or Consumer Courts within statutory jurisdiction thresholds.",
          ],
        },
        {
          heading: "17. Electronic Confirmation and Enforcement",
          paragraphs: [
            "The Buyer declares having reviewed, understood, and agreed to all terms of this Agreement electronically before placing the order. The Agreement takes effect immediately upon payment confirmation.",
          ],
        },
      ],
    },
    preInformation: {
      key: "preInformation",
      version: LEGAL_VERSIONS.preInformation,
      lastUpdated: "August 27, 2026",
      title: "Pre-Information Form",
      badge: "Pre-Order Information",
      intro:
        "This Pre-Information Form is provided in accordance with consumer regulations to inform the Buyer prior to confirming their online order.",
      sections: [
        {
          heading: "1. Service Provider Details",
          paragraphs: [
            "Service Provider: Oriens Academy\nWebsite: https://oriens-academy.com\nAddress: Emaar Square, The Heights E Block, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / Istanbul\nEmail: info@oriens-academy.com / payments@oriens-academy.com\nPhone: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
          ],
        },
        {
          heading: "2. Key Characteristics and Price",
          paragraphs: [
            "The package name, lesson count, list price, applied discounts, and total payable amount are explicitly displayed on the checkout confirmation screen and order summary.",
          ],
        },
        {
          heading: "3. Payment and Performance",
          paragraphs: [
            "Payments are accepted by credit or debit card through PayTR's 256-bit SSL infrastructure. Lesson credits are allocated to the selected learner account upon payment confirmation.",
          ],
        },
        {
          heading: "4. Cancellation and Refunds",
          paragraphs: [
            "Buyers can request cancellation prior to lesson delivery. Where lessons have commenced, the deduction rule set out in the Cancellation & Refund Policy applies.",
          ],
        },
        {
          heading: "5. Refund Deduction Rule",
          paragraphs: [
            "If lessons have been used, completed lessons are deducted at the undiscounted standard single-lesson list price communicated at purchase, and the remaining balance is refunded. Statutory rights are fully preserved.",
          ],
        },
        {
          heading: "6. Inquiries and Complaints",
          paragraphs: [
            "Inquiries or complaints may be directed to info@oriens-academy.com or submitted to competent Consumer Arbitration bodies.",
          ],
        },
      ],
    },
    refundPolicy: {
      key: "refundPolicy",
      version: LEGAL_VERSIONS.refundPolicy,
      lastUpdated: "August 27, 2026",
      title: "Cancellation & Refund Policy",
      badge: "Consumer Refund Policy",
      intro:
        "Oriens Academy provides transparent, fair, and compliant refund terms for our international academic tutoring and university admissions programs.",
      sections: [
        {
          heading: "1. Cancellation Before Service Commencement",
          paragraphs: [
            "If no tutoring sessions have taken place under the purchased package, the Buyer may request cancellation and receive a full refund within statutory cancellation periods without penalty.",
          ],
        },
        {
          heading: "2. Refund Calculation for Partially Used Packages",
          paragraphs: [
            "If one or more lessons have already been completed under a package, completed lessons are calculated and deducted based on the undiscounted standard single-lesson list price communicated at purchase time.",
            "The total cost of completed lessons is deducted from the actual total amount paid by the customer for the package.",
            "Any remaining positive balance is refunded to the original payment method in accordance with applicable regulations and payment processor settlement cycles.",
            "This calculation shall under no circumstances generate additional debt or a negative balance for the customer.",
            "All statutory consumer rights under applicable law are preserved.",
          ],
        },
        {
          heading: "3. Illustrative Calculation Example",
          paragraphs: [
            "The following is an illustrative calculation demonstrating the rule (actual refunds utilize snapshot values recorded at transaction time):",
          ],
          bullets: [
            "Actual amount paid for package: 27,000 TRY",
            "Undiscounted standard single-lesson list price at purchase: 3,200 TRY",
            "Completed / utilized lessons: 3 lessons",
            "Lesson usage deduction (3 × 3,200 TRY): 9,600 TRY",
            "Refundable remaining balance (27,000 TRY - 9,600 TRY): 17,400 TRY",
          ],
        },
        {
          heading: "4. Processing and Payouts",
          paragraphs: [
            "Refund requests must be submitted in writing to payments@oriens-academy.com. Approved refunds are credited back to the original card or bank account according to standard banking processing cycles.",
          ],
        },
        {
          heading: "5. Support Contact",
          paragraphs: [
            "For inquiries regarding refunds and accounting, please contact payments@oriens-academy.com or our support line at 0850 304 04 67.",
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
        "Oriens Academy (\"Service Provider\"), acting as data controller, prioritizes the security, confidentiality, and lawful processing of your personal data.",
      sections: [
        {
          heading: "1. Data Controller",
          paragraphs: [
            "Service Provider: Oriens Academy\nAddress: Emaar Square, The Heights E Block, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / Istanbul\nEmail: info@oriens-academy.com | Support: info@oriens-academy.com\nPhone: 0850 304 04 67 | WhatsApp: +90 544 293 90 40",
          ],
        },
        {
          heading: "2. Categories of Processed Data",
          paragraphs: [
            "Identity data (name, surname) and contact data (email) are processed for account creation and communication. Phone number is not collected as a general profile/contact field; it is requested only at the card-payment step for that transaction's 3D Secure verification and is not saved to your student/account profile. We also process transaction and order records, student learning logs, and web log data.",
          ],
        },
        {
          heading: "3. Purposes of Processing",
          paragraphs: [
            "To deliver educational and consulting services, schedule lessons, process payments, fulfill statutory obligations, and provide customer support.",
          ],
        },
        {
          heading: "4. Data Transfers",
          paragraphs: [
            "Data is shared strictly to the extent necessary with authorized public institutions; our licensed payment processor PayTR; Supabase for authentication, database, and application infrastructure; Google Workspace for transactional email delivery; and Cloudflare (Turnstile) for website security and bot/abuse prevention.",
          ],
        },
        {
          heading: "5. Data Subject Rights and Account Deletion",
          paragraphs: [
            "You possess the right to learn whether your data is processed, request information, request correction or deletion, and object to unlawful processing.",
            "You can request deletion or anonymization of your account directly from the student portal's \"Delete My Account\" option. As long as you have no active lesson rights, no upcoming lesson, and no payment/refund in progress, your identifying details are deleted or irreversibly anonymized. Financial/legal records that must be retained by law (e.g. payment transactions) continue to be kept separately, independent of your identity, for the period required by applicable regulation.",
            "Requests can be submitted to info@oriens-academy.com.",
          ],
        },
      ],
    },
    cookie: {
      key: "cookie",
      version: LEGAL_VERSIONS.cookiePolicy,
      lastUpdated: "August 27, 2026",
      title: "Cookie Policy",
      badge: "Cookie and Privacy Preferences",
      intro:
        "Oriens Academy uses cookies on oriens-academy.com to enhance browsing experience, maintain security, and optimize platform functionality.",
      sections: [
        {
          heading: "1. What are Cookies?",
          paragraphs: [
            "Cookies are small text files placed on your device to remember user preferences and ensure smooth navigation across secure sessions.",
          ],
        },
        {
          heading: "2. Categories of Cookies Used",
          paragraphs: [
            "We utilize strictly necessary cookies (authentication, session security, checkout) alongside optional analytics and preference cookies based on user consent.",
          ],
        },
        {
          heading: "3. Managing Cookie Preferences",
          paragraphs: [
            "You may review and adjust your cookie preferences at any time using our on-site cookie consent banner or browser privacy settings.",
          ],
        },
      ],
    },
    privacy: {
      key: "privacy",
      version: LEGAL_VERSIONS.privacyPolicy,
      lastUpdated: "August 27, 2026",
      title: "Privacy Policy",
      badge: "Privacy and Security",
      intro:
        "Oriens Academy is dedicated to safeguarding the privacy and personal data of our students and site visitors.",
      sections: [
        {
          heading: "1. Information Collection",
          paragraphs: [
            "We collect basic information (name, email) when you create an account. Your phone number is not requested as a general profile field; it is only asked when paying by card, solely for that transaction's 3D Secure verification, and is not saved to your account or student profile.",
          ],
        },
        {
          heading: "2. Payment Security",
          paragraphs: [
            "Payment transactions are secured via PayTR's 256-bit SSL encrypted and 3D Secure verified infrastructure. Sensitive card numbers are never stored on our servers.",
          ],
        },
        {
          heading: "3. Third-Party Integrations",
          paragraphs: [
            "We only partner with trusted service providers necessary for service fulfillment: Supabase (authentication and database), PayTR (payments), Google Workspace (transactional email), Google Calendar/Meet (lesson scheduling and video), and Cloudflare Turnstile (security and bot prevention). We do not sell user data.",
          ],
        },
        {
          heading: "4. Account Deletion and Data Retention",
          paragraphs: [
            "You can delete or anonymize your account directly from the student portal. As long as you have no active lesson rights, no upcoming lesson, and no payment/refund in progress, your personal profile details are deleted or irreversibly anonymized. Financial/legal records such as payment transactions that must be retained by law are kept separately, independent of your identity, for the period required by applicable regulation.",
          ],
        },
        {
          heading: "5. Contact",
          paragraphs: [
            "For questions regarding our privacy practices, contact info@oriens-academy.com.",
          ],
        },
      ],
    },
    terms: {
      key: "terms",
      version: LEGAL_VERSIONS.terms,
      lastUpdated: "August 27, 2026",
      title: "Terms of Service",
      badge: "Website Terms",
      intro:
        "By accessing or using oriens-academy.com and associated educational services, you agree to these Terms of Service.",
      sections: [
        {
          heading: "1. Service Scope",
          paragraphs: [
            "Oriens Academy provides online tutoring and university admissions advisory programs for international academic examinations.",
          ],
        },
        {
          heading: "2. Intellectual Property",
          paragraphs: [
            "All website materials, logos, course documentation, and lesson content remain the exclusive intellectual property of Oriens Academy and are protected by copyright laws.",
          ],
        },
        {
          heading: "3. Related Legal Documents",
          paragraphs: [
            "Please review our complementary consumer and data protection policies:",
          ],
          bullets: [
            "Distance Sales Agreement (/en/distance-sales-agreement)",
            "Pre-Information Form (/en/pre-information-form)",
            "Cancellation & Refund Policy (/en/cancellation-refund-policy)",
            "Personal Data (KVKK) Notice (/en/kvkk-notice)",
            "Privacy Policy (/en/privacy)",
            "Cookie Policy (/en/cookie-policy)",
          ],
        },
        {
          heading: "4. Contact",
          paragraphs: [
            "For questions regarding terms of use, contact info@oriens-academy.com or 0850 304 04 67.",
          ],
        },
      ],
    },
  },
};
