import { chromium } from "playwright";

const baseUrl = process.env.ORIENS_QA_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("oriens_local_dev_auth", JSON.stringify({ accountType: "admin", email: "qa.admin@oriens-academy.com" }));
});
await context.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Content-Range": "*/0" }, body: "[]" }));
const page = await context.newPage();
let documents = 0;
const txt404 = [];
page.on("request", (request) => { if (request.resourceType() === "document") documents += 1; });
page.on("response", (response) => { if (response.status() === 404 && response.url().includes(".txt")) txt404.push(response.url()); });

try {
  await page.goto(`${baseUrl}/admin/blog/`);
  await page.getByRole("heading", { name: "Blog Yönetimi" }).waitFor();
  documents = 0;
  await Promise.all([page.waitForURL("**/admin/odemeler/"), page.locator('a[href="/admin/odemeler/"]').first().click()]);
  await Promise.all([page.waitForURL("**/admin/blog/"), page.locator('a[href="/admin/blog/"]').first().click()]);
  await Promise.all([page.waitForURL("**/admin/blog/editor/"), page.locator('a[href="/admin/blog/editor/"]').first().click()]);
  if (await page.locator('input').filter({ has: page.getByText("Slug") }).count()) throw new Error("Slug input is present");
  await page.getByText("Kapak Görseli", { exact: true }).waitFor();
  await page.getByText("PDF/Dosya Ekle", { exact: true }).waitFor();
  if (documents !== 0) throw new Error(`Unexpected document navigations: ${documents}`);
  if (txt404.length) throw new Error(`RSC .txt 404 responses: ${txt404.join(", ")}`);
  console.log(JSON.stringify({ topLevelDocuments: documents, rscTxt404: txt404.length, editor: "FULL_PAGE", slugInput: "REMOVED" }));
} finally {
  await browser.close();
}
