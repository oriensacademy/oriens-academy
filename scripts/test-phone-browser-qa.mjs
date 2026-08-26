import assert from "node:assert";

console.log("==================================================");
console.log("ORIENS ACADEMY — BROWSER / HTML PHONE PARITY QA");
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

async function run() {
  // 1. Check TR Home Page
  const homeTrRes = await fetch("http://localhost:3000/tr");
  const homeTrHtml = await homeTrRes.text();

  check("TR Home page returns 200", homeTrRes.status === 200);
  check("TR Home footer has WhatsApp link (+90 544 293 90 40)",
    homeTrHtml.includes('href="https://wa.me/905442939040"') &&
    homeTrHtml.includes("+90 544 293 90 40")
  );
  check("TR Home footer has Telefon link (0850 304 04 67 / tel:08503040467)",
    homeTrHtml.includes('href="tel:08503040467"') &&
    homeTrHtml.includes("0850 304 04 67")
  );
  check("TR Home JSON-LD includes telephone 0850 304 04 67",
    homeTrHtml.includes('"0850 304 04 67"')
  );

  // 2. Check EN Home Page
  const homeEnRes = await fetch("http://localhost:3000/en");
  const homeEnHtml = await homeEnRes.text();

  check("EN Home page returns 200", homeEnRes.status === 200);
  check("EN Home footer has WhatsApp link (+90 544 293 90 40)",
    homeEnHtml.includes('href="https://wa.me/905442939040"') &&
    homeEnHtml.includes("+90 544 293 90 40")
  );
  check("EN Home footer has Phone link (0850 304 04 67 / tel:08503040467)",
    homeEnHtml.includes('href="tel:08503040467"') &&
    homeEnHtml.includes("0850 304 04 67")
  );

  // 3. Check TR Dedicated Contact Page
  const contactTrRes = await fetch("http://localhost:3000/tr/iletisim");
  const contactTrHtml = await contactTrRes.text();

  check("TR Contact page returns 200", contactTrRes.status === 200);
  check("TR Contact page has WhatsApp row (+90 544 293 90 40)",
    contactTrHtml.includes('href="https://wa.me/905442939040"')
  );
  check("TR Contact page has Telefon row (tel:08503040467)",
    contactTrHtml.includes('href="tel:08503040467"') &&
    contactTrHtml.includes("0850 304 04 67")
  );
  check("TR Contact page does NOT contain separate 'Cep Telefonu' row",
    !contactTrHtml.includes("Cep Telefonu")
  );

  // 4. Check EN Dedicated Contact Page
  const contactEnRes = await fetch("http://localhost:3000/en/contact");
  const contactEnHtml = await contactEnRes.text();

  check("EN Contact page returns 200", contactEnRes.status === 200);
  check("EN Contact page has WhatsApp row (+90 544 293 90 40)",
    contactEnHtml.includes('href="https://wa.me/905442939040"')
  );
  check("EN Contact page has Phone row (tel:08503040467)",
    contactEnHtml.includes('href="tel:08503040467"') &&
    contactEnHtml.includes("0850 304 04 67")
  );
  check("EN Contact page does NOT contain separate 'Mobile' row in contact links",
    !contactEnHtml.includes("Mobile ·") && !contactEnHtml.includes("Mobile: ")
  );

  // 5. Check TR & EN About Pages
  const aboutTrRes = await fetch("http://localhost:3000/tr/hakkimizda");
  const aboutTrHtml = await aboutTrRes.text();
  check("TR About page contains 0850 304 04 67", aboutTrHtml.includes("0850 304 04 67"));
  check("TR About page preserves +90 544 293 90 40", aboutTrHtml.includes("+90 544 293 90 40"));

  const aboutEnRes = await fetch("http://localhost:3000/en/about");
  const aboutEnHtml = await aboutEnRes.text();
  check("EN About page contains 0850 304 04 67", aboutEnHtml.includes("0850 304 04 67"));
  check("EN About page preserves +90 544 293 90 40", aboutEnHtml.includes("+90 544 293 90 40"));

  console.log("\n==================================================");
  console.log(`HTML PARITY QA: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
