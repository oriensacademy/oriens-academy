import { chromium } from "playwright";

const base = (process.env.LIVE_BASE_URL || "https://oriens-academy.com").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const issues = [];
const routes = [];

page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  const source = message.location().url || "";
  if (message.type() === "error" && !source.includes("challenges.cloudflare.com")) {
    issues.push(`console: ${message.text()}`);
  }
});

try {
  for (const path of ["/tr/ogrenci/giris/", "/en/student/login/"]) {
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 30_000 });
    routes.push({ path, status: response?.status(), url: page.url() });
  }

  const scripts = await page.locator("script[src]").evaluateAll((elements) =>
    elements.map((element) => element.src)
  );
  let personalizationQueryHits = 0;
  for (const source of scripts) {
    const bundle = await (await fetch(source)).text();
    if (bundle.includes("onboarding=personalization")) personalizationQueryHits += 1;
  }

  const result = {
    base,
    routes,
    personalizationQueryHits,
    issues: [...new Set(issues)],
    readOnly: true,
    otpRequests: 0,
  };
  console.log(JSON.stringify(result, null, 2));
  if (routes.some((route) => route.status !== 200) || personalizationQueryHits !== 0 || issues.length !== 0) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
