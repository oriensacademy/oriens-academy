export const CONTACT = {
  email: "oriensacademy@gmail.com",
  emailHref: "mailto:oriensacademy@gmail.com",
  phoneDisplay: "+90 544 293 90 40",
  phoneHref: "tel:+905442939040",
  whatsappHref: "https://wa.me/905442939040",
  instagramHref: "https://instagram.com/oriens.academy",
} as const;

export type ContactChannel = "instagram" | "whatsapp" | "phone" | "mail";
