export const CONTACT = {
  email: "info@oriens-academy.com",
  emailHref: "mailto:info@oriens-academy.com",
  contactEmail: "contact@oriens-academy.com",
  supportEmail: "support@oriens-academy.com",
  paymentsEmail: "payments@oriens-academy.com",
  // WhatsApp
  whatsappDisplay: "+90 544 293 90 40",
  whatsappHref: "https://wa.me/905442939040",
  // Corporate Phone (0850)
  phoneDisplay: "0850 304 04 67",
  phoneHref: "tel:08503040467",
  landlineDisplay: "0850 304 04 67",
  landlineHref: "tel:08503040467",
  corporatePhoneDisplay: "0850 304 04 67",
  corporatePhoneHref: "tel:08503040467",
  // Mobile / Internal WhatsApp reference
  mobileDisplay: "+90 544 293 90 40",
  mobileHref: "https://wa.me/905442939040",
  instagramHref: "https://instagram.com/oriens.academy",
  businessAddress: {
    tr: "Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul",
    en: "Emaar Square, The Heights E Block, Ünalan Neighborhood, Libadiye Street No:82, Üsküdar / Istanbul",
  },
  businessAddressLines: {
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
} as const;

export type ContactChannel = "instagram" | "whatsapp" | "phone" | "mail";
