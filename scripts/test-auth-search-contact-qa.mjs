async function runQA() {
  console.log("==================================================");
  console.log("ORIENS ACADEMY — AUTH / SEARCH / CONTACT / PREFERENCES QA");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Test HTTP Routes on localhost:3000
  console.log("\n[TEST GROUP: Localhost HTTP Route Verification & Markup Inspection]");
  const routesToTest = [
    { url: "http://localhost:3000/tr", name: "Homepage TR" },
    { url: "http://localhost:3000/en", name: "Homepage EN" },
    { url: "http://localhost:3000/tr/iletisim", name: "Dedicated Contact Route TR" },
    { url: "http://localhost:3000/en/contact", name: "Dedicated Contact Route EN" },
    { url: "http://localhost:3000/tr/giris", name: "Unified Login Page TR" },
    { url: "http://localhost:3000/en/login", name: "Unified Login Page EN" },
    { url: "http://localhost:3000/tr/kendini-dene", name: "Exam Test Page TR" },
    { url: "http://localhost:3000/en/test-yourself", name: "Exam Test Page EN" },
    { url: "http://localhost:3000/tr/privacy", name: "Privacy Policy TR" },
    { url: "http://localhost:3000/tr/terms", name: "Terms of Service TR" },
    { url: "http://localhost:3000/admin/ogrenciler", name: "Admin Students Management" },
  ];

  for (const r of routesToTest) {
    try {
      const res = await fetch(r.url);
      const text = await res.text();
      assert(res.status === 200, `${r.name} (${r.url}) responded with HTTP 200 OK`);

      if (r.url.includes("kendini-dene") || r.url.includes("test-yourself")) {
        const hasDisclaimerTr = text.includes("Bu test yapısı örnek içerikle hazırlanmıştır");
        const hasDisclaimerEn = text.includes("This assessment currently uses placeholder content");
        assert(!hasDisclaimerTr && !hasDisclaimerEn, "Test disclaimer is completely removed from rendered Exam Test page");
      }

      if (r.url.includes("/tr/iletisim") || r.url.includes("/en/contact")) {
        const hasAddress = text.includes("Emaar Square");
        assert(hasAddress, `Dedicated Contact page contains Emaar Square address`);
        const hasWhatsApp = text.includes("544 293 90 40");
        assert(hasWhatsApp, `Dedicated Contact page contains WhatsApp contact`);
      }

      if (r.url === "http://localhost:3000/tr" || r.url === "http://localhost:3000/en") {
        const hasSeparateSecurityHeading = text.includes("Adres ve Güvenlik");
        assert(!hasSeparateSecurityHeading, "Footer 'Adres ve Güvenlik' separate column heading is removed");
        const hasPaymentMethodsImage = text.includes("odeme_altyapi.png");
        assert(hasPaymentMethodsImage, "Footer uses the current payment infrastructure artwork");
      }

      if (r.url.includes("/tr/giris") || r.url.includes("/en/login")) {
        const hasAuthSwitch = text.includes("Oturum Aç") || text.includes("Sign In");
        assert(hasAuthSwitch, "Unified login page renders authentication switch");
      }
    } catch (err) {
      assert(false, `${r.name} failed to fetch: ${err.message}`);
    }
  }

  console.log("\n==================================================");
  console.log(`QA SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
}

runQA();
