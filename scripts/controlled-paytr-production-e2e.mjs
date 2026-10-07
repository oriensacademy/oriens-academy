import { execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "mwbrlfmdpbkmdjroxhcc";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const SITE_URL = "https://oriens-academy.com";
const COUPON_CODE = "TESTKUPON";
const PACKAGE_ID = "single";
const MAX_CHARGE_KURUS = 1000;
const QA_PHONE = "+905550000000";

const rawKeys = execSync(
  `npx supabase projects api-keys --project-ref ${PROJECT_REF}`,
  { encoding: "utf8", windowsHide: true },
);
const keys = JSON.parse(rawKeys.slice(rawKeys.indexOf("{"))).keys;
const anonKey = keys.find((key) => key.id === "anon")?.api_key;
const serviceKey = keys.find((key) => key.id === "service_role")?.api_key;
if (!anonKey || !serviceKey) throw new Error("Required project credentials are unavailable.");

const service = createClient(PROJECT_URL, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(PROJECT_URL, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
let email = `qa-student-a-${suffix}@example.test`;
const password = `Qa!${crypto.randomUUID()}aA1`;
let browser;
let page;
let userId;
let reference;
let transactionCreated = false;
let stopped = false;
let lastState = "";
const network = [];
const MAX_NETWORK_ENTRIES = 100;
let secureIframeLoaded = false;

function safePaytrPath(pathname) {
  if (pathname.startsWith("/odeme/guvenli/")) return "/odeme/guvenli/REDACTED";
  if (pathname.includes("/payment/get/token/")) {
    return pathname.replace(/\/payment\/get\/token\/[^/]+/, "/payment/get/token/REDACTED");
  }
  return pathname;
}

function emit(type, data = {}) {
  process.stdout.write(`${JSON.stringify({ type, at: new Date().toISOString(), ...data })}\n`);
}

function validPublicReference(value) {
  return /^ORI[A-Za-z0-9]+$/.test(value || "") && value.length <= 64;
}

function safeCustomerSummary(transaction) {
  const emailValue = String(transaction?.payer_email || "");
  const phoneValue = String(transaction?.payer_phone || "");
  const nameValue = String(transaction?.payer_name || "");
  const addressValue = String(transaction?.payer_address || "");
  return {
    email: {
      present: Boolean(emailValue),
      valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue),
      length: emailValue.length,
      ascii: /^[\x00-\x7F]*$/.test(emailValue),
    },
    user_name: { present: Boolean(nameValue), length: nameValue.length, withinPaytrLimit: nameValue.length <= 60 },
    user_address: { present: Boolean(addressValue), length: addressValue.length, withinPaytrLimit: addressValue.length <= 400 },
    user_phone: { present: Boolean(phoneValue), valid: /^\+[1-9][0-9]{6,14}$/.test(phoneValue), length: phoneValue.length },
  };
}

async function readState() {
  if (!reference) return null;
  const [{ data: transaction, error: txError }, { data: audits, error: auditError }] = await Promise.all([
    service
      .from("payment_transactions")
      .select("id,public_reference,package_id,amount,currency,status,provider,payment_method,is_archived,created_at,updated_at,payer_name,payer_email,payer_phone,payer_address,metadata")
      .eq("public_reference", reference)
      .single(),
    service
      .from("audit_logs")
      .select("action,created_at,metadata")
      .eq("entity_type", "payment_transaction")
      .eq("entity_id", reference)
      .order("created_at", { ascending: true }),
  ]);
  if (txError) throw txError;
  if (auditError) throw auditError;

  const meta = transaction.metadata || {};
  const items = Array.isArray(meta.checkout_items)
    ? meta.checkout_items.map((item) => ({
        item_name: String(item.package_name || ""),
        item_price: Number(item.final_amount || 0).toFixed(2),
        quantity: 1,
      }))
    : [];
  const basketKurus = items.reduce(
    (sum, item) => sum + Math.round(Number(item.item_price) * 100) * item.quantity,
    0,
  );
  const safeAudits = (audits || []).map((row) => ({
    action: row.action,
    created_at: row.created_at,
    failed_reason_code: row.metadata?.failed_reason_code ?? null,
    failed_reason_msg: row.metadata?.failed_reason_msg ?? null,
    failure_type: row.metadata?.failure_type ?? null,
    http_status: row.metadata?.http_status ?? null,
    safe_error_code: row.metadata?.safe_error_code ?? null,
    safe_error_message: row.metadata?.safe_error_message ?? null,
  }));
  return {
    reference: transaction.public_reference,
    transactionId: transaction.id,
    status: transaction.status,
    statusReason: meta.failure_reason || meta.status_reason || null,
    amountTl: Number(transaction.amount),
    amountKurus: Math.round(Number(transaction.amount) * 100),
    currency: transaction.currency,
    provider: transaction.provider,
    paymentMethod: transaction.payment_method,
    archived: transaction.is_archived,
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at,
    pricing: {
      subtotalKurus: Number(meta.subtotal_kurus),
      discountKurus: Number(meta.discount_kurus),
      finalKurus: Number(meta.final_total_kurus),
      transactionKurus: Math.round(Number(transaction.amount) * 100),
      paytrPaymentAmount: Number(meta.final_total_kurus),
    },
    basket: {
      encoding: "base64(JSON UTF-8)",
      items,
      basketKurus,
      matchesPaymentAmount: basketKurus === Number(meta.final_total_kurus),
    },
    customer: safeCustomerSummary(transaction),
    providerTestMode: meta.provider_test_mode === true ? "1" : "0",
    auditTimeline: safeAudits,
  };
}

async function emitState(type = "STATE") {
  const state = await readState();
  if (state) emit(type, state);
  return state;
}

async function monitor() {
  while (!stopped) {
    try {
      const state = await readState();
      if (state) {
        const fingerprint = JSON.stringify({
          status: state.status,
          updatedAt: state.updatedAt,
          timeline: state.auditTimeline.map((event) => [event.action, event.created_at]),
        });
        if (fingerprint !== lastState) {
          lastState = fingerprint;
          emit("STATE_CHANGE", state);
        }
        if (["paid", "failed", "cancelled", "refunded"].includes(state.status)) {
          emit("TERMINAL_STATE_REACHED", { reference: state.reference, status: state.status });
          await shutdown();
          return;
        }
      }
    } catch (error) {
      emit("MONITOR_ERROR", { message: error instanceof Error ? error.message : "unknown" });
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
}

async function start() {
  const resumeReference = String(process.env.PAYTR_E2E_RESUME_REFERENCE || "").trim();
  if (resumeReference) {
    const existing = await service
      .from("payment_transactions")
      .select("auth_actor_user_id")
      .eq("public_reference", resumeReference)
      .single();
    if (existing.error || !existing.data?.auth_actor_user_id) {
      throw existing.error || new Error("Resume reference has no QA actor.");
    }
    userId = existing.data.auth_actor_user_id;
    const existingUser = await service.auth.admin.getUserById(userId);
    if (existingUser.error || !existingUser.data.user?.email) throw existingUser.error || new Error("QA actor is unavailable.");
    email = existingUser.data.user.email;
    const reset = await service.auth.admin.updateUserById(userId, { password });
    if (reset.error) throw reset.error;
    transactionCreated = true;
    emit("QA_ACCOUNT_RESUMED", { priorReference: resumeReference });
  } else {
    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "student", qa_scope: "paytr_e2e" },
      user_metadata: { full_name: "PayTR E2E QA", preferred_language: "tr" },
    });
    if (created.error || !created.data.user) throw created.error || new Error("QA user creation failed.");
    userId = created.data.user.id;
  }

  const verified = await service
    .from("guardian_accounts")
    .update({ email_verified_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("user_id")
    .single();
  if (verified.error) throw verified.error;

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error || new Error("QA sign-in failed.");

  browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({ viewport: { width: 1280, height: 920 } });
  const authKey = `sb-${PROJECT_REF}-auth-token`;
  const cartKey = `oriens_cart_user_${userId}`;
  await context.addInitScript(
    ({ authKeyValue, sessionValue, cartKeyValue }) => {
      localStorage.setItem(authKeyValue, JSON.stringify(sessionValue));
      localStorage.setItem(cartKeyValue, JSON.stringify([{ packageId: "single", quantity: 1 }]));
      localStorage.removeItem(`${cartKeyValue}_coupon`);
    },
    { authKeyValue: authKey, sessionValue: signedIn.data.session, cartKeyValue: cartKey },
  );

  page = await context.newPage();
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/functions/v1/paytr-create-token")) {
      try {
        const body = await response.json();
        const candidate = String(body.reference || body.merchant_oid || "");
        if (validPublicReference(candidate)) {
          reference = candidate;
          transactionCreated = true;
          emit("TOKEN_RESPONSE", {
            httpStatus: response.status(),
            success: body.success === true,
            reference,
            finalAmountTl: Number(body.final_amount),
            finalAmountKurus: Math.round(Number(body.final_amount) * 100),
            zeroPayment: body.zero_payment === true,
          });
        } else {
          emit("TOKEN_RESPONSE", {
            httpStatus: response.status(),
            success: false,
            errorCode: body.error_code || null,
            message: body.message || null,
          });
        }
      } catch {
        emit("TOKEN_RESPONSE", { httpStatus: response.status(), success: false, parseError: true });
      }
    }
    if (url.hostname.endsWith("paytr.com")) {
      if (url.pathname.startsWith("/odeme/guvenli/") && response.ok()) secureIframeLoaded = true;
      const entry = {
        method: response.request().method(),
        host: url.hostname,
        path: safePaytrPath(url.pathname),
        httpStatus: response.status(),
        contentType: response.headers()["content-type"] || null,
      };
      if (network.length < MAX_NETWORK_ENTRIES) network.push(entry);
      if (entry.path === "/odeme/guvenli/REDACTED") emit("PAYTR_IFRAME_RESPONSE", entry);
    }
  });
  page.on("framenavigated", (frame) => {
    const url = new URL(frame.url());
    if (url.hostname.endsWith("paytr.com")) {
      emit("PAYTR_FRAME_NAVIGATION", { host: url.hostname, path: safePaytrPath(url.pathname) });
    }
  });
  page.on("pageerror", (error) => emit("BROWSER_PAGE_ERROR", { message: error.message }));

  const cartResponse = await page.goto(`${SITE_URL}/tr/sepet/`, { waitUntil: "domcontentloaded" });
  if (!cartResponse?.ok()) throw new Error(`Production cart returned ${cartResponse?.status()}.`);
  await page.locator("#cart-coupon-input").waitFor({ timeout: 30_000 });
  await page.locator("#cart-coupon-input").fill(COUPON_CODE);
  await page.locator("#cart-coupon-input").press("Enter");
  await page.getByText("Kupon başarıyla uygulandı", { exact: false }).waitFor({ timeout: 30_000 });

  const totalRowText = await page.getByText("Toplam Tutar", { exact: true }).locator("..").innerText();
  const totalMatch = totalRowText.match(/([0-9.]+)(?:,([0-9]{2}))?\s*TL/);
  const displayedFinalKurus = totalMatch
    ? Number(totalMatch[1].replaceAll(".", "")) * 100 + Number(totalMatch[2] || "0")
    : undefined;
  emit("CART_ASSERTION", {
    packageId: PACKAGE_ID,
    coupon: COUPON_CODE,
    subtotalKurus: 320000,
    discountKurus: 319900,
    displayedFinalKurus,
    withinLimit: Number.isInteger(displayedFinalKurus) && displayedFinalKurus > 0 && displayedFinalKurus <= MAX_CHARGE_KURUS,
  });
  if (!Number.isInteger(displayedFinalKurus) || displayedFinalKurus <= 0 || displayedFinalKurus > MAX_CHARGE_KURUS) {
    throw new Error("Displayed cart total is outside the authorized real-charge limit.");
  }

  await page.getByRole("link", { name: "Ödemeye Geç", exact: true }).click();
  await page.waitForURL("**/tr/odeme/**", { timeout: 30_000 });
  await page.evaluate(() => {
    window.__paytrQaLifecycle = [];
    const record = (event) => window.__paytrQaLifecycle.push({ event, ms: Math.round(performance.now()) });
    window.addEventListener("focus", () => record("window_focus"));
    window.addEventListener("blur", () => record("window_blur"));
    document.addEventListener("visibilitychange", () => record(`visibility_${document.visibilityState}`));
    new MutationObserver((records) => {
      for (const mutation of records) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement) record("iframe_added");
        }
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLIFrameElement) record("iframe_removed");
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
  await page.locator("#payment-phone").fill(QA_PHONE);
  await page.getByRole("button", { name: "Ödemeye Geç", exact: true }).click();
  const tokenDeadline = Date.now() + 30_000;
  while (!reference && Date.now() < tokenDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!reference) throw new Error("The production token request did not complete within 30 seconds.");
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const pageDiagnostics = await page.evaluate(() => ({
    pagePath: location.pathname,
    iframeCount: document.querySelectorAll("iframe").length,
    iframes: Array.from(document.querySelectorAll("iframe")).map((element) => {
      const parsed = new URL(element.getAttribute("src") || location.href, location.href);
      return {
        id: element.id || null,
        host: parsed.hostname,
        isPaytrSecurePath: parsed.pathname.startsWith("/odeme/guvenli/"),
      };
    }),
    alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((element) => element.textContent?.trim()).filter(Boolean),
    lifecycle: window.__paytrQaLifecycle || [],
    proceedButtonCount: Array.from(document.querySelectorAll("button")).filter((element) => element.textContent?.includes("Ödemeye Geç")).length,
    newSessionButtonCount: Array.from(document.querySelectorAll("button")).filter((element) => element.textContent?.includes("Yeni Ödeme Oturumu")).length,
  }));
  emit("PAGE_DIAGNOSTICS", pageDiagnostics);
  const iframe = page.locator('iframe[src*="paytr.com/odeme/guvenli/"]').first();
  if ((await iframe.count()) === 0) {
    throw new Error("PayTR iframe mount event was logged but no secure iframe remains in the DOM; card entry is not authorized.");
  }
  const iframeDiagnostics = await iframe.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      visible: Boolean(rect.width && rect.height && style.visibility !== "hidden" && style.display !== "none"),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      srcHost: new URL(element.getAttribute("src") || location.href, location.href).hostname,
      isPaytrSecurePath: new URL(element.getAttribute("src") || location.href, location.href).pathname.startsWith("/odeme/guvenli/"),
    };
  });
  emit("IFRAME_DIAGNOSTICS", iframeDiagnostics);
  if (!iframeDiagnostics.visible || iframeDiagnostics.srcHost !== "www.paytr.com") {
    throw new Error("PayTR iframe is attached but not visibly usable; card entry is not authorized.");
  }
  if (!secureIframeLoaded) {
    throw new Error("The secure PayTR iframe did not return HTTP 200; card entry is not authorized.");
  }

  const deadline = Date.now() + 20_000;
  let state;
  while (Date.now() < deadline) {
    if (reference) {
      state = await readState();
      const required = new Set(state.auditTimeline.map((event) => event.action));
      if (["payment_session_requested", "paytr_token_created", "paytr_iframe_opened"].every((event) => required.has(event))) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  if (!state || state.amountKurus <= 0 || state.amountKurus > MAX_CHARGE_KURUS) {
    throw new Error("Server-side amount assertion failed; card entry is not authorized.");
  }
  const requiredEvents = new Set(state.auditTimeline.map((event) => event.action));
  if (!["payment_session_requested", "paytr_token_created", "paytr_iframe_opened"].every((event) => requiredEvents.has(event))) {
    throw new Error("Required pre-card audit events are incomplete; card entry is not authorized.");
  }
  const amounts = state.pricing;
  if (!(
    displayedFinalKurus === amounts.finalKurus &&
    amounts.finalKurus === amounts.transactionKurus &&
    amounts.transactionKurus === amounts.paytrPaymentAmount &&
    state.basket.matchesPaymentAmount
  )) {
    throw new Error("Cart/server/transaction/PayTR amount assertion mismatch; card entry is not authorized.");
  }

  emit("PRE_CARD_PASS", {
    ...state,
    displayedFinalKurus,
    expectedEventsPresent: true,
    merchantOidValid: validPublicReference(reference),
    returnUrls: {
      ok: `${SITE_URL}/tr/odeme/basarili/?reference=REDACTED&token=REDACTED`,
      fail: `${SITE_URL}/tr/odeme/basarisiz/?reference=REDACTED&token=REDACTED`,
    },
    paytrRequest: {
      merchant_id: "PRESENT",
      user_ip: "NOT_PERSISTED_EXACT_VALUE",
      merchant_oid: reference,
      email: state.customer.email,
      payment_amount: amounts.paytrPaymentAmount,
      user_basket: state.basket,
      debug_on: "PRESENT_VALUE_NOT_RETRIEVABLE",
      no_installment: "0",
      max_installment: "12",
      user_name: state.customer.user_name,
      user_address: state.customer.user_address,
      user_phone: state.customer.user_phone,
      timeout_limit: "30",
      currency: "TL",
      test_mode: state.providerTestMode,
      lang: "tr",
      paytr_token: "GENERATED_HMAC_SHA256_BASE64_REDACTED",
    },
  });
  emit("READY_FOR_CARD", { reference, finalAmountKurus: state.amountKurus, finalAmountTl: state.amountTl });
  void monitor();
}

async function shutdown() {
  if (stopped) return;
  stopped = true;
  try {
    if (reference) await emitState("FINAL_STATE");
  } catch (error) {
    emit("FINAL_STATE_ERROR", { message: error instanceof Error ? error.message : "unknown" });
  }
  await browser?.close();
  if (!transactionCreated && userId) {
    const paymentCheck = await service
      .from("payment_transactions")
      .select("id", { count: "exact", head: true })
      .or(`auth_actor_user_id.eq.${userId},purchaser_guardian_user_id.eq.${userId},package_owner_student_id.eq.${userId}`);
    if (paymentCheck.error || paymentCheck.count !== 0) {
      emit("QA_ACCOUNT_CLEANUP", { success: false, reason: "financial_relationship_check_failed" });
    } else {
      const links = await service
        .from("guardian_students")
        .delete()
        .or(`guardian_user_id.eq.${userId},student_id.eq.${userId}`);
      const guardian = links.error
        ? links
        : await service.from("guardian_accounts").delete().eq("user_id", userId);
      const authDelete = guardian.error
        ? guardian
        : await service.auth.admin.deleteUser(userId);
      emit("QA_ACCOUNT_CLEANUP", {
        success: !links.error && !guardian.error && !authDelete.error,
        financialRowsRemoved: 0,
      });
    }
  } else {
    emit("QA_ACCOUNT_PRESERVED", { reason: "financial_ledger_relationships_must_not_be_blindly_deleted" });
  }
  process.exit(0);
}

const input = createInterface({ input: process.stdin, terminal: false });
input.on("line", async (line) => {
  const command = line.trim().toLowerCase();
  if (command === "status") await emitState("MANUAL_STATE");
  if (command === "network") emit("PAYTR_NETWORK_SUMMARY", { entries: network });
  if (command === "finish") await shutdown();
});
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

start().catch(async (error) => {
  emit("ABORTED", { message: error instanceof Error ? error.message : "unknown" });
  await shutdown();
});
