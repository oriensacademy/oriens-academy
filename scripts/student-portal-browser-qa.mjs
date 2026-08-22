import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3010";
const env = readFileSync(".env.local", "utf8");
const supabaseUrl = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "") || "";
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const userId = "11111111-1111-4111-8111-111111111111";
const now = Math.floor(Date.now() / 1000);
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", exp: now + 3600, sub: userId, role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} })}.qa`;
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "student@example.test", email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [], created_at: new Date().toISOString() };
const session = { access_token: jwt, token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "qa-refresh-token", user };
const profile = { id:userId,full_name:"QA Student",email:user.email,phone:"+90 555 000 00 00",date_of_birth:null,preferred_language:"tr",school:"QA School",target_country:"United Kingdom",target_university:"QA University",target_exam:"SAT",active:true,created_at:new Date().toISOString(),updated_at:new Date().toISOString() };
const json = (route, body, object = false) => route.fulfill({ status: 200, headers: { "content-type": object ? "application/vnd.pgrst.object+json" : "application/json" }, body: JSON.stringify(body) });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: `sb-${projectRef}-auth-token`, value: session });
const page = await context.newPage(); const issues = []; const results = [];
const check = (condition, message) => { if (!condition) issues.push(message); };
page.on("pageerror", (error) => issues.push(`pageerror: ${error.message}`));
page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Turnstile")) issues.push(`console: ${message.text()}`); });
await page.route("**/auth/v1/user*", (route) => json(route, user, true));
await page.route("**/rest/v1/**", (route) => {
  const url = route.request().url(); const method = route.request().method();
  if (url.includes("student_profiles")) return json(route, profile, true);
  if (url.includes("bookings")) return json(route, [{ id:"b1",status:"confirmed",exam_code:"sat",custom_exam:null,created_at:new Date().toISOString(),availability_slots:{starts_at:"2026-09-10T10:00:00Z",ends_at:"2026-09-10T11:00:00Z"} }]);
  if (url.includes("student_lessons")) return json(route, [{id:"l1",student_user_id:userId,booking_id:null,package_purchase_id:null,title:"SAT Mathematics",subject:"Mathematics",exam_code:"sat",lesson_date:"2026-08-20T10:00:00Z",duration_minutes:60,status:"completed",teacher_note:"QA note",created_at:new Date().toISOString()}]);
  if (url.includes("student_homework")) return json(route, method === "PATCH" ? {id:"h1",status:"submitted"} : [{id:"h1",student_user_id:userId,lesson_id:"l1",title:"QA Homework",description:"Complete the assigned review.",due_date:"2026-09-12T18:00:00Z",status:"assigned",submission_text:null,submitted_at:null,teacher_feedback:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}], method === "PATCH");
  if (url.includes("student_package_purchases")) return json(route, [{id:"p1",student_user_id:userId,package_id:"package20",payment_transaction_id:"t1",lesson_count:20,lessons_used:14,start_date:"2026-07-14",end_date:null,status:"active",created_at:new Date().toISOString(),pricing_packages:{name_tr:"20 Derslik Paket",name_en:"20-Lesson Package"}}]);
  if (url.includes("payment_transactions")) return json(route, [{id:"t1",package_id:"package20",amount:51000,currency:"TRY",payment_method:"bank_transfer",status:"paid",created_at:new Date().toISOString()}]);
  if (url.includes("site_settings")) return json(route, []);
  return json(route, []);
});

for (const locale of ["tr", "en"]) {
  const register = locale === "tr" ? "/tr/ogrenci/kayit/" : "/en/student/register/";
  for (const width of [360,390,430,768,1024,1440]) {
    await page.setViewportSize({ width, height: 950 }); const response = await page.goto(`${base}${register}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth); results.push({ route:register,width,status:response?.status(),overflow }); check(response?.ok(), `${register} failed at ${width}`); check(!overflow, `${register} overflows at ${width}`);
  }
  check((await page.locator('input[type="checkbox"]').count()) === 1, `${locale} registration has unexpected consent checkboxes`);
  check((await page.getByText(locale === "tr" ? "Gizlilik Politikası" : "Privacy Policy", { exact:false }).count()) > 0, `${locale} registration terms are missing`);
}

for (const [route, welcome] of [["/tr/hesabim/","Hoş geldiniz"],["/en/account/","Welcome"]]) {
  for (const width of [360,390,430,768,1024,1440]) {
    await page.setViewportSize({ width, height: 950 }); const response = await page.goto(`${base}${route}`, { waitUntil:"domcontentloaded" }); await page.getByText(welcome,{exact:false}).waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);results.push({route,width,status:response?.status(),overflow});check(response?.ok(),`${route} failed at ${width}`);check(!overflow,`${route} overflows at ${width}`);
  }
  const body=await page.locator("body").innerText();check(body.includes("14 / 20")&&body.includes("6"),`${route} package progress is incorrect`);const homeworkTab=page.getByRole("button",{name:route.startsWith("/tr")?"Ödevlerim":"Homework"}).last();await homeworkTab.click();check((await page.getByText("QA Homework",{exact:true}).count())>0,`${route} homework view is missing`);
  const paymentTab=page.getByRole("button",{name:route.startsWith("/tr")?"Ödemelerim":"Payments"}).last();await paymentTab.click();const paymentBody=await page.locator("body").innerText();check(paymentBody.includes("51.000")||paymentBody.includes("51,000"),`${route} payment history is missing`);
}

const guestContext = await browser.newContext(); const guestPage = await guestContext.newPage();
for (const [account, login] of [["/tr/hesabim/","/tr/ogrenci/giris"],["/en/account/","/en/student/login"]]) {
  await guestPage.goto(`${base}${account}`, { waitUntil:"domcontentloaded" }); await guestPage.waitForURL((url)=>url.pathname.replace(/\/$/,"")===login); check(guestPage.url().includes(login),`${account} did not redirect an unauthenticated visitor`);
}
await guestContext.close();
await browser.close();
console.log(JSON.stringify({ result: issues.length ? "FAIL" : "PASS", results, issues }, null, 2));
if (issues.length) process.exitCode = 1;
