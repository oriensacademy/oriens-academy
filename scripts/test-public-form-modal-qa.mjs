import fs from "node:fs";
import { examSelector as trExamSelector } from "../src/content/tr/home.ts";
import { examSelector as enExamSelector } from "../src/content/en/home.ts";
import { getExamTestCopy } from "../src/content/exam-test.ts";

console.log("==================================================");
console.log("ORIENS ACADEMY — PUBLIC FORM & MODAL UX UNIT QA");
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

// 1. Exam Result Email Modal & Consultant Modal Source Code Verification
console.log("\n[TEST GROUP 1: Exam Modals & Overlay]");
const examTestResultsCode = fs.readFileSync("src/components/exam-test/ExamTestResults.tsx", "utf8");

check("ExamTestResults contains reportPhone state",
  examTestResultsCode.includes("const [reportPhone, setReportPhone] = useState")
);
check("ExamTestResults syncs user email/name/phone on login",
  examTestResultsCode.includes("setReportPhone(user.user_metadata.phone)") &&
  examTestResultsCode.includes("setReportEmail(user.email)")
);
check("Exam email modal includes phone input",
  examTestResultsCode.includes("value={reportPhone}") &&
  examTestResultsCode.includes("onChange={(e) => setReportPhone(e.target.value)}")
);
check("Exam email modal passes phone to sendExamResultEmail",
  examTestResultsCode.includes("phone: reportPhone.trim() || undefined")
);
check("Exam email modal has clean placeholders",
  examTestResultsCode.includes('placeholder={isTr ? "Adınız Soyadınız" : "Your full name"}') &&
  examTestResultsCode.includes('placeholder={isTr ? "E-posta adresiniz" : "Your email address"}') &&
  !examTestResultsCode.includes('placeholder="ornek@email.com"')
);
check("Consultant modal has clean placeholders and empty phone placeholder",
  !examTestResultsCode.includes("copy.phonePlaceholder") &&
  !examTestResultsCode.includes("0555 555 55 55")
);
check("Modal overlay uses rock-solid full viewport backdrop without bottom gap",
  examTestResultsCode.includes('className="fixed inset-0 z-[999] overflow-y-auto"') &&
  examTestResultsCode.includes('className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"')
);
check("Modal includes body scroll lock handling",
  examTestResultsCode.includes('document.body.style.overflow = "hidden"')
);

// 2. Consultation Form & Exam Selector Verification
console.log("\n[TEST GROUP 2: Consultation Form & Exam Optionality]");
check("TR exam selector heading indicates optional",
  trExamSelector.heading === "Hazırlandığınız sınav (isteğe bağlı)"
);
check("TR exam selector placeholder does NOT contain fake exam examples",
  trExamSelector.inputPlaceholder === "Sınav adı (isteğe bağlı)" &&
  !trExamSelector.inputPlaceholder.includes("örn.") &&
  !trExamSelector.inputPlaceholder.includes("SAT")
);
check("EN exam selector heading indicates optional",
  enExamSelector.heading === "Exam you're preparing for (optional)"
);
check("EN exam selector placeholder does NOT contain fake exam examples",
  enExamSelector.inputPlaceholder === "Exam name (optional)" &&
  !enExamSelector.inputPlaceholder.includes("e.g.") &&
  !enExamSelector.inputPlaceholder.includes("SAT")
);

const bookingCtaCode = fs.readFileSync("src/components/sections/BookingCTA.tsx", "utf8");
check("BookingCTA email placeholder is clean",
  bookingCtaCode.includes('placeholder={isTr ? "E-posta adresiniz" : "Your email address"}') &&
  !bookingCtaCode.includes('placeholder="ornek@email.com"')
);
check("BookingCTA phone has no placeholder",
  !bookingCtaCode.includes('placeholder={isTr ? "0555')
);

// 3. Email Template Optional Field Omission
console.log("\n[TEST GROUP 3: Email Template Cleanliness]");
const emailTemplatesCode = fs.readFileSync("supabase/functions/_shared/email/templates.ts", "utf8");
check("Admin contact email omits empty optional fields without showing dashes or None",
  emailTemplatesCode.includes("...(data.phone ? [{ label: isTr ? \"Telefon\" : \"Phone\", value: escapeHtml(data.phone) }] : [])") &&
  emailTemplatesCode.includes("...(data.subject ? [{ label: isTr ? \"Konu / Sınav\" : \"Subject\", value: escapeHtml(data.subject) }] : [])")
);

// 4. Site-wide Fake Placeholders Check
console.log("\n[TEST GROUP 4: Site-Wide Customer-Facing Placeholders]");
const customerFacingFiles = [
  "src/components/auth/UnifiedLoginPage.tsx",
  "src/components/assessment/AssessmentForm.tsx",
  "src/components/booking/BookingFlow.tsx",
  "src/components/contact/ContactForm.tsx",
  "src/components/contact/QuickContactLead.tsx",
  "src/components/sections/BookingCTA.tsx",
  "src/components/exam-test/ExamTestResults.tsx",
  "src/components/student/StudentPortal.tsx",
];

let foundCustomerViolations = 0;
for (const file of customerFacingFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (content.includes("ornek@email.com") || content.includes("ornek@domain.com") || content.includes("ornek@alanadi.com")) {
    console.error(`Violation in ${file}: fake email example found!`);
    foundCustomerViolations++;
  }
  if (content.includes("0555 555 55 55") || content.includes("+90 5XX")) {
    console.error(`Violation in ${file}: fake phone example found!`);
    foundCustomerViolations++;
  }
  if (content.includes("Örn: Ela Demir") || content.includes("Ahmet Yılmaz") || content.includes("John Doe")) {
    console.error(`Violation in ${file}: fake name example found!`);
    foundCustomerViolations++;
  }
}
check("Zero customer-facing fake placeholders detected across the codebase", foundCustomerViolations === 0);

console.log("\n==================================================");
console.log(`QA RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) process.exit(1);
