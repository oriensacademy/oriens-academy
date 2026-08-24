export const CONTACT = {
  email: "info@oriens-academy.com",
  emailHref: "mailto:info@oriens-academy.com",
  phoneDisplay: "+90 544 293 90 40",
  phoneHref: "tel:+905442939040",
  whatsappHref: "https://wa.me/905442939040",
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
