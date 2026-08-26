import assert from "node:assert";
import { CONTACT } from "../src/config/contact.ts";
import { about as aboutTr } from "../src/content/tr/about.ts";
import { about as aboutEn } from "../src/content/en/about.ts";
import { renderAdminContactEmail } from "../supabase/functions/_shared/email/templates.ts";

console.log("==================================================");
console.log("ORIENS ACADEMY — SECOND CONTACT PHONE PARITY QA");
console.log("==================================================");

let passed = 0;
let failed = 0;

function check(title, condition) {
  if (condition) {
    console.log(`✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${title}`);
    failed++;
  }
}

// 1. Canonical CONTACT configuration verification
console.log("\n[TEST GROUP 1: Canonical Contact Configuration]");
check("Phone display is canonical 0850 number (0850 304 04 67)",
  CONTACT.phoneDisplay === "0850 304 04 67" &&
  CONTACT.landlineDisplay === "0850 304 04 67" &&
  CONTACT.corporatePhoneDisplay === "0850 304 04 67"
);

check("Phone href is tel:08503040467",
  CONTACT.phoneHref === "tel:08503040467" &&
  CONTACT.landlineHref === "tel:08503040467" &&
  CONTACT.corporatePhoneHref === "tel:08503040467"
);

check("WhatsApp display is +90 544 293 90 40",
  CONTACT.whatsappDisplay === "+90 544 293 90 40"
);

check("WhatsApp href is https://wa.me/905442939040",
  CONTACT.whatsappHref === "https://wa.me/905442939040"
);

// 2. About page trust links verification
console.log("\n[TEST GROUP 2: About Page Trust Channels]");
const trPhoneLink = aboutTr.trust.links.find((l) => l.title === "Telefon");
check("TR About content contains Telefon channel with 0850 304 04 67",
  !!trPhoneLink && trPhoneLink.description.includes("0850 304 04 67")
);

const trWhatsAppLink = aboutTr.trust.links.find((l) => l.title === "WhatsApp");
check("TR About content preserves WhatsApp channel with +90 544 293 90 40",
  !!trWhatsAppLink && trWhatsAppLink.description.includes("+90 544 293 90 40")
);

const enPhoneLink = aboutEn.trust.links.find((l) => l.title === "Phone");
check("EN About content contains Phone channel with 0850 304 04 67",
  !!enPhoneLink && enPhoneLink.description.includes("0850 304 04 67")
);

const enWhatsAppLink = aboutEn.trust.links.find((l) => l.title === "WhatsApp");
check("EN About content preserves WhatsApp channel with +90 544 293 90 40",
  !!enWhatsAppLink && enWhatsAppLink.description.includes("+90 544 293 90 40")
);

// 3. Email templates footer verification
console.log("\n[TEST GROUP 3: Email Templates Footer Contact]");
const renderedEmail = renderAdminContactEmail({
  fullName: "Test User",
  email: "test@example.com",
  phone: "+90 555 123 4567",
  subject: "Inquiry",
  message: "Hello",
  locale: "tr",
  contactId: "test-contact-123",
});

check("Email footer contains Phone link (tel:08503040467)",
  renderedEmail.html.includes("tel:08503040467") &&
  renderedEmail.html.includes("0850 304 04 67")
);

check("Email footer contains WhatsApp link (https://wa.me/905442939040)",
  renderedEmail.html.includes("https://wa.me/905442939040") &&
  renderedEmail.html.includes("+90 544 293 90 40")
);

console.log("\n==================================================");
console.log(`PARITY QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
