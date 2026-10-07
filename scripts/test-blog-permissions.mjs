import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const projectRef = "mwbrlfmdpbkmdjroxhcc";
const projectUrl = `https://${projectRef}.supabase.co`;
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
let anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let serviceKey = process.env.SUPABASE_SECRET_KEY;
if (!anonKey || !serviceKey) {
  const rawKeys = execSync(`npx supabase projects api-keys --project-ref ${projectRef}`, {
    encoding: "utf8",
    windowsHide: true,
  });
  const keyPayload = JSON.parse(rawKeys.slice(rawKeys.indexOf("{")));
  anonKey ||= keyPayload.keys.find((key) => key.type === "publishable" && key.name === "default")?.api_key;
  serviceKey ||= keyPayload.keys.find((key) => key.type === "secret" && key.name === "default")?.api_key;
}
if (!anonKey || !serviceKey) throw new Error("Supabase project API keys are unavailable.");

const service = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const slug = `blog-permission-qa-temp-${suffix}`;
const password = `Qa!${crypto.randomUUID()}aA1`;
const adminEmail = `qa-blog-admin-${suffix}@example.test`;
const studentEmail = `qa-blog-student-${suffix}@example.test`;
const userIds = [];
let postId = null;
let browser = null;
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, pass: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
}

async function authenticatedClient(email) {
  const client = createClient(projectUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error || new Error("QA sign-in failed.");
  return client;
}

async function createQaUser(email, role) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { full_name: role === "admin" ? "QA Blog Admin" : "QA Blog Student" },
  });
  if (data?.user?.id) userIds.push(data.user.id);
  if (error || !data.user) throw error || new Error("QA user creation failed.");
}

async function cleanup() {
  if (browser) {
    try { await browser.close(); } catch (e) { console.error("Browser close error:", e.message); }
  }
  if (postId) {
    try { await service.from("blog_posts").delete().eq("id", postId).eq("slug", slug); } catch (e) { console.error("Post delete error:", e.message); }
  }
  if (userIds.length > 0) {
    try {
      await service.from("notification_deliveries").delete().in("recipient", [adminEmail, studentEmail]);
    } catch (e) { console.error("Notification cleanup error:", e.message); }
    try {
      await service.from("guardian_students").delete().in("guardian_user_id", userIds);
    } catch (e) { console.error("Guardian students cleanup error:", e.message); }
    try {
      await service.from("guardian_accounts").delete().in("user_id", userIds);
    } catch (e) { console.error("Guardian accounts cleanup error:", e.message); }
    try {
      await service.from("student_profiles").delete().in("id", userIds);
    } catch (e) { console.error("Student profiles cleanup error:", e.message); }
    for (const userId of userIds) {
      try {
        await service.auth.admin.deleteUser(userId);
      } catch (e) {
        console.error(`Auth user delete error for ${userId}:`, e.message);
      }
    }
  }
  const { count } = await service.from("blog_posts").select("id", { count: "exact", head: true }).eq("slug", slug);
  check("QA fixture cleanup", (count ?? 0) === 0, `remaining rows: ${count ?? 0}`);
}

try {
  const schemaMigration = readFileSync("supabase/migrations/20260904100000_blog_posts.sql", "utf8");
  const repairMigration = readFileSync("supabase/migrations/20260915231500_repair_blog_posts_permissions.sql", "utf8");
  check("RLS enabled", /enable row level security/i.test(schemaMigration));
  check("RLS forced", /force row level security/i.test(schemaMigration));
  check("public policy is published-only", /status = 'published'.*published_at is not null.*published_at <= now\(\)/is.test(schemaMigration));
  check("admin policy uses is_admin", /Admin blog posts policy[\s\S]*public\.is_admin\(\)/i.test(schemaMigration));
  check("anon ACL is SELECT-only", /revoke all privileges[\s\S]*grant select on table public\.blog_posts to anon;/i.test(repairMigration));
  check("authenticated ACL omits DELETE", /grant select, insert, update on table public\.blog_posts to authenticated;/i.test(repairMigration));

  const browserSource = [
    "src/lib/supabase/client.ts",
    "src/lib/admin/blog.ts",
    "src/app/admin/blog/page.tsx",
    "src/components/admin/BlogEditorPage.tsx",
    "src/components/blog/BlogListPage.tsx",
    "src/components/blog/BlogDetailPage.tsx",
  ];
  const privilegedBrowserReferences = browserSource.filter((path) =>
    /(?:process|import\.meta)\.env(?:\.|\[)["']?SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY)|sb_secret_[a-z0-9]/i.test(readFileSync(path, "utf8"))
  );
  check("no service-role browser usage", privilegedBrowserReferences.length === 0, privilegedBrowserReferences.join(", "));

  const deniedAnonWrite = await anon.from("blog_posts").insert({
    locale: "tr", slug: `${slug}-anon`, title: "Blocked anon", excerpt: "Blocked", content: "Blocked", status: "draft",
  });
  check("anon cannot write", Boolean(deniedAnonWrite.error), deniedAnonWrite.error?.message);

  await createQaUser(adminEmail, "admin");
  await createQaUser(studentEmail, "student");
  const [admin, student] = await Promise.all([authenticatedClient(adminEmail), authenticatedClient(studentEmail)]);

  const deniedStudentWrite = await student.from("blog_posts").insert({
    locale: "tr", slug: `${slug}-student`, title: "Blocked student", excerpt: "Blocked", content: "Blocked", status: "draft",
  });
  check("normal authenticated user cannot write", Boolean(deniedStudentWrite.error), deniedStudentWrite.error?.message);

  const created = await admin.from("blog_posts").insert({
    locale: "tr",
    slug,
    title: "BLOG PERMISSION QA TEMP",
    excerpt: "Temporary permission verification fixture.",
    content: "Temporary permission verification fixture.",
    status: "draft",
  }).select("id,status,title").single();
  check("admin can create", !created.error && created.data?.status === "draft", created.error?.message);
  postId = created.data.id;

  const draftPublic = await anon.from("blog_posts").select("id").eq("id", postId);
  check("anon cannot read draft", !draftPublic.error && draftPublic.data.length === 0, draftPublic.error?.message);
  const adminDraft = await admin.from("blog_posts").select("id,status").eq("id", postId).single();
  check("admin can read draft", !adminDraft.error && adminDraft.data?.status === "draft", adminDraft.error?.message);

  const updated = await admin.from("blog_posts").update({ title: "BLOG PERMISSION QA TEMP UPDATED" }).eq("id", postId).select("title").single();
  check("admin can update", !updated.error && updated.data?.title.endsWith("UPDATED"), updated.error?.message);

  const published = await admin.rpc("admin_publish_blog_post", { p_post_id: postId, p_scheduled_at: null });
  check("admin can publish", !published.error && published.data?.success === true, published.error?.message);
  const publishedPublic = await anon.from("blog_posts").select("id,title,status").eq("id", postId).single();
  check("anon can read published", !publishedPublic.error && publishedPublic.data?.status === "published", publishedPublic.error?.message);

  const publicList = await anon.from("blog_posts").select("id").eq("locale", "tr").eq("status", "published").eq("id", postId);
  check("public list includes published", !publicList.error && publicList.data.length === 1, publicList.error?.message);
  const publicDetail = await anon.from("blog_posts").select("id").eq("locale", "tr").eq("slug", slug).single();
  check("public detail includes published", !publicDetail.error && publicDetail.data?.id === postId, publicDetail.error?.message);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const relevantConsoleErrors = [];
  const blogAuthFailures = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /supabase|blog_posts|permission denied/i.test(message.text())) {
      relevantConsoleErrors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/rest/v1/blog_posts") && [401, 403].includes(response.status())) {
      blogAuthFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  const listResponsePromise = page.waitForResponse((response) => response.url().includes("/rest/v1/blog_posts?") && response.url().includes("locale=eq.tr"));
  await page.goto("https://oriens-academy.com/tr/blog/", { waitUntil: "domcontentloaded" });
  const listResponse = await listResponsePromise;
  const listPayload = await listResponse.json();
  check("production list query returns HTTP 200", listResponse.status() === 200, String(listResponse.status()));
  check("production list query includes published fixture", Array.isArray(listPayload) && listPayload.some((row) => row.id === postId));
  await page.getByText("BLOG PERMISSION QA TEMP UPDATED", { exact: true }).waitFor({ state: "attached" });
  check("published post renders in production list", true);
  const detailResponsePromise = page.waitForResponse((response) => response.url().includes("/rest/v1/blog_posts?") && response.url().includes(`slug=eq.${slug}`));
  await page.goto(`https://oriens-academy.com/tr/blog/${slug}/`, { waitUntil: "domcontentloaded" });
  const detailResponse = await detailResponsePromise;
  check("production detail query returns HTTP 200", detailResponse.status() === 200, String(detailResponse.status()));
  await page.getByRole("heading", { name: "BLOG PERMISSION QA TEMP UPDATED" }).waitFor();
  check("published post renders in production detail", true);

  await page.route("**/rest/v1/admin_profiles*", async (route) => {
    const now = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ user_id: userIds[0], display_name: "QA Blog Admin", role: "admin", active: true, created_at: now, updated_at: now }]),
    });
  });
  await page.goto("https://oriens-academy.com/tr/giris?next=%2Fadmin%2Fblog", { waitUntil: "domcontentloaded" });
  await page.locator("#account-email").fill(adminEmail);
  await page.locator("#account-password").fill(password);
  await page.getByRole("button", { name: "Giriş Yap", exact: true }).click();
  await page.waitForURL(/\/admin\/blog\/?$/, { timeout: 20_000 });
  await page.getByText("BLOG PERMISSION QA TEMP UPDATED", { exact: true }).waitFor();
  check("admin blog route and list render", true);
  check("browser blog 401/403 count is zero", blogAuthFailures.length === 0, blogAuthFailures.join(", "));
  check("browser relevant Supabase errors are zero", relevantConsoleErrors.length === 0, relevantConsoleErrors.join(", "));

  const unpublished = await admin.from("blog_posts").update({ status: "draft", published_at: null }).eq("id", postId).select("status").single();
  check("admin can unpublish", !unpublished.error && unpublished.data?.status === "draft", unpublished.error?.message);
  const unpublishedPublic = await anon.from("blog_posts").select("id").eq("id", postId);
  check("unpublished post is hidden", !unpublishedPublic.error && unpublishedPublic.data.length === 0, unpublishedPublic.error?.message);

  const activeRow = page.locator("tr").filter({ hasText: "BLOG PERMISSION QA TEMP UPDATED" });
  await activeRow.getByRole("button", { name: "Arşivle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Arşivle", exact: true }).click();
  await activeRow.waitFor({ state: "detached" });
  const archived = await admin.from("blog_posts").select("status").eq("id", postId).single();
  check("admin can archive through UI", !archived.error && archived.data?.status === "archived", archived.error?.message);
  const activeList = await admin.from("blog_posts").select("id").neq("status", "archived").eq("id", postId);
  const archiveList = await admin.from("blog_posts").select("id").eq("status", "archived").eq("id", postId);
  check("archived post leaves active list", !activeList.error && activeList.data.length === 0, activeList.error?.message);
  check("archived post remains recoverable", !archiveList.error && archiveList.data.length === 1, archiveList.error?.message);
  const archivedPublic = await anon.from("blog_posts").select("id").eq("id", postId);
  check("archived post is not public", !archivedPublic.error && archivedPublic.data.length === 0, archivedPublic.error?.message);

  check("archived post is hidden from active admin list", await page.getByText("BLOG PERMISSION QA TEMP UPDATED", { exact: true }).count() === 0);
  await page.getByRole("tab", { name: "Arşiv" }).click();
  await page.getByText("BLOG PERMISSION QA TEMP UPDATED", { exact: true }).waitFor();
  check("archive view renders recoverable post", true);

  const archivedRow = page.locator("tr").filter({ hasText: "BLOG PERMISSION QA TEMP UPDATED" });
  await archivedRow.getByRole("button", { name: "Geri Yükle" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Geri Yükle", exact: true }).click();
  await archivedRow.waitFor({ state: "detached" });
  const restored = await admin.from("blog_posts").select("status,published_at").eq("id", postId).single();
  check("admin can restore through UI to draft", !restored.error && restored.data?.status === "draft" && restored.data?.published_at === null, restored.error?.message);

  const routes = await Promise.all([
    fetch("https://oriens-academy.com/tr/blog/", { redirect: "manual" }),
    fetch("https://oriens-academy.com/en/blog/", { redirect: "manual" }),
    fetch(`https://oriens-academy.com/tr/blog/${slug}/`, { redirect: "manual" }),
  ]);
  check("TR blog route HTTP 200", routes[0].status === 200, String(routes[0].status));
  check("EN blog route HTTP 200", routes[1].status === 200, String(routes[1].status));
  check("blog detail route HTTP 200", routes[2].status === 200, String(routes[2].status));

  console.log(JSON.stringify({ result: "PASS", projectRef, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: "FAIL", message: error.message, checks }, null, 2));
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    console.error(JSON.stringify({ cleanup: "FAIL", message: cleanupError.message }));
    process.exitCode = 1;
  }
}
