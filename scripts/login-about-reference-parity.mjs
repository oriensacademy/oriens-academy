import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const mode = process.argv.includes("--reference-only") ? "reference" : "all";
const baseUrl = process.env.PARITY_BASE_URL || "https://oriens-academy.com";
const outputDirectory = process.env.PARITY_OUTPUT_DIR || "test-results/login-about-parity";
const viewports = [390, 820, 1280, 1440];
const targets = {
  loginReference: pathToFileURL("C:/Users/merto/Downloads/oriens-giris-iyilestirilmis_14.html").href,
  aboutReference: pathToFileURL("C:/Users/merto/Downloads/oriens-hakkimizda-iyilestirilmis_21.html").href,
  loginImplementation: `${baseUrl}/tr/giris/`,
  aboutImplementation: `${baseUrl}/tr/hakkimizda/`,
};
const selected = mode === "reference"
  ? Object.entries(targets).filter(([name]) => name.endsWith("Reference"))
  : Object.entries(targets);
const browser = await chromium.launch({ headless: true });
const report = {};
await mkdir(outputDirectory, { recursive: true });

for (const [name, url] of selected) {
  report[name] = [];
  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: width < 900 ? 1000 : 1100 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.addInitScript(() => sessionStorage.setItem("oriens-loader-seen", "1"));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${outputDirectory}/${name}-${width}.png`, fullPage: true });
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      height: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.querySelector("h1")?.textContent?.trim() || "",
      sections: document.querySelectorAll("main section, body > div > section").length,
    }));
    assert.ok(metrics.scrollWidth <= width, `${name} has horizontal overflow at ${width}px`);
    if (name.endsWith("Implementation")) {
      assert.deepEqual(consoleErrors, [], `${name} logged browser errors at ${width}px`);
      if (name.startsWith("login")) {
        assert.equal(metrics.title, "Hesabınıza giriş yapın");
        assert.equal(await page.getByRole("tab", { name: "Giriş Yap", exact: true }).count(), 1);
        assert.equal(await page.getByRole("tab", { name: "Kayıt Ol", exact: true }).count(), 1);
        assert.equal(await page.locator("aside li").count(), 4);
        if (width === 390 || width === 1440) {
          await page.getByRole("tab", { name: "Kayıt Ol", exact: true }).click();
          assert.equal((await page.locator("h1:visible").first().textContent())?.trim(), "Veli hesabı oluşturun");
          assert.equal(await page.locator("#r-pass").getAttribute("minlength"), "6");
          await page.screenshot({ path: `${outputDirectory}/${name}-register-${width}.png`, fullPage: true });
        }
      } else {
        assert.equal(metrics.title, "Oriens Academy ile tanışın.");
        assert.equal(metrics.sections, 4);
        assert.equal(await page.locator("main section").nth(1).locator("li").count(), 6);
        assert.equal(await page.locator("main section").nth(2).locator("h3").count(), 9);
        assert.equal(await page.locator("main section").nth(3).locator("li").count(), 4);
      }
    }
    report[name].push({ ...metrics, consoleErrors });
    await page.close();
  }
}

if (mode === "all") {
  const otpSource = await readFile("src/components/auth/EmailOtpGate.tsx", "utf8");
  assert.match(otpSource, /Array\.from\(\{ length: 6 \}/, "OTP must render six fields");
  assert.match(otpSource, /index === 3/, "OTP must keep the 3 + separator + 3 layout");
  assert.match(otpSource, /verifyPurchaseEmailVerification/, "custom Oriens OTP backend must remain wired");

  const forgot = await browser.newPage({ viewport: { width: 390, height: 1000 } });
  await forgot.addInitScript(() => sessionStorage.setItem("oriens-loader-seen", "1"));
  await forgot.goto(`${baseUrl}/tr/sifremi-unuttum/`, { waitUntil: "domcontentloaded" });
  await forgot.locator("h1").first().waitFor();
  assert.equal((await forgot.locator("h1").first().textContent())?.trim(), "Şifrenizi sıfırlayın");
  assert.equal(await forgot.locator("input[type=email]").count(), 1);
  await forgot.screenshot({ path: `${outputDirectory}/forgotImplementation-390.png`, fullPage: true });
  await forgot.close();

  for (const [path, expectedTitle] of [["/en/login/", "Sign In to Your Account"], ["/en/about/", "Meet Oriens Academy."]]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
    await page.addInitScript(() => sessionStorage.setItem("oriens-loader-seen", "1"));
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor();
    assert.equal((await page.locator("h1").first().textContent())?.trim(), expectedTitle);
    await page.close();
  }
}
await browser.close();
await writeFile(`${outputDirectory}/baseline.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
