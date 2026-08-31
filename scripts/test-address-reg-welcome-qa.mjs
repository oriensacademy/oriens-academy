import assert from "node:assert";
import { CONTACT } from "../src/config/contact.ts";
import { validateStudentPhone } from "../src/lib/student/auth.ts";
import { renderStudentWelcomeEmail } from "../supabase/functions/_shared/email/templates.ts";

console.log("==================================================");
console.log("ORIENS ACADEMY — ADDRESS, REGISTRATION & WELCOME EMAIL UNIT QA");
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

// 1. Address Verification
console.log("\n[TEST GROUP 1: Canonical Business Address]");
check("TR address matches exact canonical format",
  CONTACT.businessAddress.tr === "Emaar Square, The Heights E Blok, Ünalan Mah., Libadiye Cd. No:82, Üsküdar / İstanbul"
);
check("TR address lines match exact canonical lines",
  CONTACT.businessAddressLines.tr[0] === "Emaar Square, The Heights E Blok" &&
  CONTACT.businessAddressLines.tr[1] === "Ünalan Mah., Libadiye Cd. No:82" &&
  CONTACT.businessAddressLines.tr[2] === "Üsküdar / İstanbul"
);
check("EN address matches natural English representation",
  CONTACT.businessAddress.en === "Emaar Square, The Heights E Block, Ünalan Neighborhood, Libadiye Street No:82, Üsküdar / Istanbul"
);
check("EN address lines match natural English representation",
  CONTACT.businessAddressLines.en[0] === "Emaar Square, The Heights E Block" &&
  CONTACT.businessAddressLines.en[1] === "Ünalan Neighborhood, Libadiye Street No:82" &&
  CONTACT.businessAddressLines.en[2] === "Üsküdar / Istanbul"
);

// 2. Phone Validation Tests
console.log("\n[TEST GROUP 2: Phone Validation & International Support]");
const testPhones = [
  { input: "05321234567", expectedValid: true, desc: "Leading 0 standard TR number" },
  { input: "5321234567", expectedValid: true, desc: "10-digit number without leading 0" },
  { input: "+905321234567", expectedValid: true, desc: "+90 prefix format" },
  { input: "+441234567890", expectedValid: true, desc: "UK international number (+44)" },
  { input: "+1 555 234 5678", expectedValid: true, desc: "US international formatted number" },
  { input: "+49 170 1234567", expectedValid: true, desc: "German international formatted number" },
  { input: "0532 123 45 67", expectedValid: true, desc: "Formatted TR number with spaces" },
  { input: "(0532) 123-4567", expectedValid: true, desc: "Formatted number with parentheses and dashes" },
  { input: "abc1234567", expectedValid: false, desc: "Contains alphabetic letters (must be rejected)" },
  { input: "+90abc55500", expectedValid: false, desc: "Contains letters with +90 (must be rejected)" },
  { input: "12345", expectedValid: false, desc: "Too short (< 7 digits, must be rejected)" },
  { input: "", expectedValid: false, desc: "Empty string (must be rejected)" },
];

for (const tp of testPhones) {
  const resultTr = validateStudentPhone(tp.input, true);
  const resultEn = validateStudentPhone(tp.input, false);
  check(`Phone "${tp.input}" (${tp.desc}) valid === ${tp.expectedValid}`,
    resultTr.valid === tp.expectedValid && resultEn.valid === tp.expectedValid
  );
}

// 3. Welcome Email Template Verification
console.log("\n[TEST GROUP 3: Welcome Email Templates (TR & EN)]");

const trWelcome = renderStudentWelcomeEmail({
  studentName: "Mert Ömeroğlu",
  studentEmail: "test@oriens-academy.com",
  locale: "tr",
});

check("TR Welcome Email subject is exact",
  trWelcome.subject === "Oriens Academy’ye Hoş Geldiniz"
);
check("TR Welcome Email contains personalized greeting",
  trWelcome.html.includes("Mert Ömeroğlu") && trWelcome.text.includes("Mert Ömeroğlu")
);
check("TR Welcome Email contains account created statement",
  trWelcome.html.includes("Oriens Academy hesabınız başarıyla oluşturuldu.")
);
check("TR Welcome Email contains feature list",
  trWelcome.html.includes("sınav geçmişinizi görüntüleyebilir") &&
  trWelcome.html.includes("ders ve randevularınızı takip edebilir") &&
  trWelcome.html.includes("ödevlerinizi görüntüleyip teslim edebilir") &&
  trWelcome.html.includes("paket ve ödeme bilgilerinizi inceleyebilir") &&
  trWelcome.html.includes("destek ekibimizle iletişime geçebilirsiniz")
);
check("TR Welcome Email CTA label is 'Hesabıma Git'",
  trWelcome.html.includes("Hesabıma Git") && trWelcome.text.includes("Hesabıma Git")
);
check("TR Welcome Email CTA URL is 'https://oriens-academy.com/tr/hesabim/'",
  trWelcome.html.includes("https://oriens-academy.com/tr/hesabim/")
);
check("TR Welcome Email contains official footer contacts",
  trWelcome.html.includes("info@oriens-academy.com")
);
check("TR Welcome Email contains updated canonical address",
  trWelcome.html.includes("Emaar Square, The Heights E Blok")
);

const enWelcome = renderStudentWelcomeEmail({
  studentName: "John Smith",
  studentEmail: "john@oriens-academy.com",
  locale: "en",
});

check("EN Welcome Email subject is exact",
  enWelcome.subject === "Welcome to Oriens Academy"
);
check("EN Welcome Email contains personalized greeting",
  enWelcome.html.includes("John Smith") && enWelcome.text.includes("John Smith")
);
check("EN Welcome Email contains account created statement",
  enWelcome.html.includes("Your Oriens Academy account has been created successfully.")
);
check("EN Welcome Email contains feature list",
  enWelcome.html.includes("review your exam history") &&
  enWelcome.html.includes("track lessons and appointments") &&
  enWelcome.html.includes("view and submit assignments") &&
  enWelcome.html.includes("manage package and payment information") &&
  enWelcome.html.includes("contact the Oriens Academy support team")
);
check("EN Welcome Email CTA label is 'Go to My Account'",
  enWelcome.html.includes("Go to My Account") && enWelcome.text.includes("Go to My Account")
);
check("EN Welcome Email CTA URL is 'https://oriens-academy.com/en/account/'",
  enWelcome.html.includes("https://oriens-academy.com/en/account/")
);
check("EN Welcome Email contains updated canonical English address",
  enWelcome.html.includes("Emaar Square, The Heights E Block")
);

console.log("\n==================================================");
console.log(`QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
