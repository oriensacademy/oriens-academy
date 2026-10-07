import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const directory = path.resolve("scratch/customer-revision-email-previews");
const browser = await chromium.launch({ headless: true });
for (const file of ["MAIL-027-TR", "MAIL-027-EN", "MAIL-041-TR", "MAIL-041-EN", "PACKAGE-RIGHTS-TR", "PACKAGE-RIGHTS-EN"]) {
  for (const width of [760, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(directory, file + ".html")).href);
    await page.screenshot({ path: path.join(directory, file + "-" + width + ".png"), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log("Captured 12 desktop/mobile preview screenshots.");
