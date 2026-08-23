export const CONTACT = {
  email: "info@oriens-academy.com",
  emailHref: "mailto:info@oriens-academy.com",
  phoneDisplay: "+90 544 293 90 40",
  phoneHref: "tel:+905442939040",
  whatsappHref: "https://wa.me/905442939040",
  instagramHref: "https://instagram.com/oriens.academy",
  businessAddress: {
    tr: "Ünalan Mahallesi, Libadiye Caddesi, No: 82, Emaar Square Sitesi, E Blok, Üsküdar / İstanbul",
    en: "Ünalan Neighbourhood, Libadiye Avenue, No. 82, Emaar Square Complex, Block E, Üsküdar / Istanbul",
  },
} as const;

export type ContactChannel = "instagram" | "whatsapp" | "phone" | "mail";
