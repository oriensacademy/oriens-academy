console.log("==================================================");
console.log("ORIENS ACADEMY — LIVE PRODUCTION VERIFICATION");
console.log("Domain: https://oriens-academy.com");
console.log("==================================================");

const routes = [
  "https://oriens-academy.com/tr",
  "https://oriens-academy.com/en",
  "https://oriens-academy.com/tr/kendini-dene",
  "https://oriens-academy.com/en/try-yourself",
  "https://oriens-academy.com/tr/iletisim",
  "https://oriens-academy.com/en/contact",
];

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

async function verifyRoute(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Oriens-QA-Bot/1.0" } });
    if (!res.ok) {
      check(`HTTP 200 OK for ${url} (status: ${res.status})`, false);
      return;
    }
    const html = await res.text();
    check(`HTTP 200 OK for ${url}`, true);

    // Check address in footer / schema
    if (url.includes("/tr") || url.includes("/en")) {
      check(`${url} includes canonical Emaar Square address`, html.includes("Emaar Square, The Heights E Blok"));
    }

    // Check that bad placeholders are NOT in HTML
    check(`${url} does not contain ornek@email.com`, !html.includes("ornek@email.com"));
    check(`${url} does not contain 0555 555 55 55`, !html.includes("0555 555 55 55"));
    check(`${url} does not contain +90 5XX`, !html.includes("+90 5XX"));

    // Check optional exam header if homepage
    if (url.endsWith("/tr")) {
      check(`TR homepage includes optional exam header`, html.includes("Hazırlandığınız sınav (isteğe bağlı)"));
    }
    if (url.endsWith("/en")) {
      check(`EN homepage includes optional exam header`, html.includes("Exam you&#x27;re preparing for (optional)") || html.includes("Exam you're preparing for (optional)"));
    }
  } catch (err) {
    check(`Fetch error for ${url}: ${err.message}`, false);
  }
}

async function run() {
  for (const route of routes) {
    await verifyRoute(route);
  }

  console.log("\n==================================================");
  console.log(`PRODUCTION LIVE QA RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");
  if (failed > 0) process.exit(1);
}

run();
