import { mkdir, writeFile } from "node:fs/promises";

const adminEmail = process.env.ORIENS_LOCAL_ADMIN_EMAIL;
const adminPassword = process.env.ORIENS_LOCAL_ADMIN_PASSWORD;
const localPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!adminEmail || !adminPassword || !localPublishableKey) {
  throw new Error("Explicit local admin QA credentials and Supabase publishable key are required.");
}

const endpoint = "http://127.0.0.1:9223";
const target = await fetch(`${endpoint}/json/new?http://localhost:3000/tr/ucretler/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const waiters = new Map();
const issues = [];
const requests = [];
let id = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
    return;
  }
  const tasks = waiters.get(message.method) || [];
  waiters.delete(message.method);
  tasks.forEach((resolve) => resolve(message.params));
  if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) issues.push(`console:${message.params.type}:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) issues.push(`log:${message.params.entry.level}:${message.params.entry.text}`);
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) issues.push(`http:${message.params.response.status}:${message.params.response.url}`);
});

function send(method, params = {}) {
  const commandId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}
function waitFor(method, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${method}`)), timeout);
    const wrapped = (value) => { clearTimeout(timer); resolve(value); };
    waiters.set(method, [...(waiters.get(method) || []), wrapped]);
  });
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(`${result.exceptionDetails.text}: ${result.exceptionDetails.exception?.description || ""}`);
  return result.result.value;
}
async function navigate(route, width, height, wait = 1800) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  const loaded = waitFor("Page.loadEventFired");
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await loaded;
  await pause(wait);
}

await mkdir("test-results", { recursive: true });
await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);
await send("Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem('oriens-loader-seen','1')` });

const viewportResults = [];
for (const [width, height] of [[360,800],[390,844],[430,932],[768,1024],[1024,768],[1280,800],[1440,900],[1920,1080]]) {
  await navigate("/tr/ucretler/", width, height);
  viewportResults.push(await evaluate(`(() => {
    const cards = [...document.querySelectorAll('[data-creative-pricing] [data-package-id]')];
    const rects = cards.map((card) => card.getBoundingClientRect());
    const firstRowTop = rects.length ? Math.min(...rects.map((rect) => Math.round(rect.top))) : 0;
    const firstRowIndexes = rects.map((rect, index) => ({ rect, index })).filter(({ rect }) => Math.abs(Math.round(rect.top) - firstRowTop) < 5);
    const columns = firstRowIndexes.length;
    const buttons = cards.map((card) => card.querySelector('a')?.getBoundingClientRect().top || 0);
    const firstRowButtons = firstRowIndexes.map(({ index }) => buttons[index]);
    const badges = cards.map((card) => card.querySelector('article > div.absolute')).filter(Boolean).map((node) => node.getBoundingClientRect());
    return {
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      count: cards.length,
      columns,
      rotations: cards.map((card) => getComputedStyle(card).rotate),
      prices: cards.map((card) => [...card.innerText.matchAll(/₺[0-9.]+/g)].map((match) => match[0]).at(-2) || ''),
      popular: document.querySelector('[data-package-id="package10"]')?.getAttribute('data-popular'),
      package30Badge: document.querySelector('[data-package-id="package30"]')?.innerText.includes('EN AVANTAJLI PAKET'),
      oldTable: !!document.querySelector('#packages table'),
      forbiddenSaas: ['$', '/month', 'Popular!', 'Get Started', 'Simple Pricing', 'Make Short Videos'].some((value) => (document.querySelector('#packages')?.innerText || '').toLowerCase().includes(value.toLowerCase())),
      cardsInViewport: rects.every((rect) => rect.left >= -1 && rect.right <= innerWidth + 1),
      badgesInViewport: badges.every((rect) => rect.left >= 0 && rect.right <= innerWidth),
      ctaAlignmentDelta: firstRowButtons.length ? Math.max(...firstRowButtons) - Math.min(...firstRowButtons) : 0,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
    };
  })()`));
}

await navigate("/en/pricing/", 1440, 900);
const english = await evaluate(`(() => ({
  h1: document.querySelector('h1')?.textContent?.trim() || '',
  count: document.querySelectorAll('[data-package-id]').length,
  names: [...document.querySelectorAll('[data-package-id] h3')].map((node) => node.textContent.trim()),
  badges: [...document.querySelectorAll('[data-package-id] article > div.absolute')].map((node) => node.textContent.trim()),
  discounts: [...document.querySelectorAll('[data-package-id]')].map((node) => node.innerText.match(/[0-9]+% OFF/)?.[0] || '—'),
  ctaLabels: [...document.querySelectorAll('[data-package-id] article > a')].map((node) => node.textContent.trim()),
  currency: [...document.querySelectorAll('[data-package-id]')].every((node) => node.innerText.includes('₺')),
}))()`);

await navigate("/tr/ucretler/", 1440, 900);
const trShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/creative-pricing-tr-1440.png", Buffer.from(trShot.data, "base64"));
await navigate("/en/pricing/", 390, 844);
const enShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/creative-pricing-en-390.png", Buffer.from(enShot.data, "base64"));

await navigate("/tr/ucretler/", 1440, 900);
const ctaRoute = await evaluate(`(async () => {
  const cta = document.querySelector('[data-package-id="package10"] article > a');
  const href = cta?.getAttribute('href') || '';
  cta?.click();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return { href, path: location.pathname, search: location.search, hash: location.hash };
})()`);

await navigate("/admin/login/", 1440, 900);
const adminLogin = await evaluate(`(async () => {
  if (!document.querySelector('#admin-email')) return { alreadyAuthenticated: true, path: location.pathname };
  const set = (element, value) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); };
  set(document.querySelector('#admin-email'), ${JSON.stringify(adminEmail)});
  set(document.querySelector('#admin-password'), ${JSON.stringify(adminPassword)});
  document.querySelector('form').requestSubmit();
  for (let i = 0; i < 30; i += 1) { await new Promise((resolve) => setTimeout(resolve, 250)); if (location.pathname === '/admin/') break; }
  return { alreadyAuthenticated: false, path: location.pathname };
})()`);

async function editPackage20(description) {
  await navigate("/admin/fiyatlandirma/", 1440, 900, 1600);
  const opened = await evaluate(`(async () => {
    const row = [...document.querySelectorAll('tbody tr')].find((node) => node.innerText.includes('package20'));
    const edit = [...(row?.querySelectorAll('button') || [])].find((node) => /Düzenle/.test(node.textContent || ''));
    edit?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const form = document.querySelector('.fixed.inset-0 form');
    const labels = [...(form?.querySelectorAll('label') || [])];
    const nameInput = labels.find((node) => node.firstChild?.textContent?.trim() === 'Paket Adı (TR)')?.querySelector('input');
    const input = labels.find((node) => node.firstChild?.textContent?.trim() === 'Description (EN)')?.querySelector('input');
    return { row: !!row, edit: !!edit, form: !!form, input: !!input, nameInput: !!nameInput };
  })()`);
  if (!opened.input || !opened.nameInput) return { ...opened, saved: false };
  async function replaceField(labelText, value) {
    await evaluate(`(() => { const label = [...document.querySelectorAll('.fixed.inset-0 form label')].find((node) => node.firstChild?.textContent?.trim() === ${JSON.stringify(labelText)}); label?.querySelector('input')?.focus(); })()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17, modifiers: 2 });
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", windowsVirtualKeyCode: 65, modifiers: 2 });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Control", code: "ControlLeft", windowsVirtualKeyCode: 17 });
    await send("Input.insertText", { text: value });
    await pause(120);
    return evaluate(`document.activeElement?.value || ''`);
  }
  const nameValue = await replaceField("Paket Adı (TR)", "20 Derslik Paket");
  const inputValue = await replaceField("Description (EN)", description);
  await evaluate(`document.querySelector('.fixed.inset-0 form')?.requestSubmit()`);
  for (let i = 0; i < 20; i += 1) { await pause(150); if (!(await evaluate(`!!document.querySelector('.fixed.inset-0 form')`))) break; }
  return { ...opened, nameValue, inputValue, saved: !(await evaluate(`!!document.querySelector('.fixed.inset-0 form')`)) };
}

const qaDescription = `QA public sync ${Date.now()}`;
const adminSave = await editPackage20(qaDescription);
const dbAfterSave = await fetch("http://127.0.0.1:54321/rest/v1/pricing_packages?id=eq.package20&select=description_en", { headers: { apikey: localPublishableKey } }).then((response) => response.json());
await navigate("/en/pricing/", 1440, 900);
const publicSync = await evaluate(`document.querySelector('[data-package-id="package20"]')?.innerText.includes(${JSON.stringify(qaDescription)}) || false`);
const adminRestore = await editPackage20("A structured path for ongoing progress");
const dbAfterRestore = await fetch("http://127.0.0.1:54321/rest/v1/pricing_packages?id=eq.package20&select=description_en", { headers: { apikey: localPublishableKey } }).then((response) => response.json());
await navigate("/en/pricing/", 1440, 900);
const publicRestore = await evaluate(`document.querySelector('[data-package-id="package20"]')?.innerText.includes('A structured path for ongoing progress') || false`);

const productionRequests = [...new Set(requests)].filter((url) => /https:\/\/[^/]*\.supabase\.co/i.test(url));
const unexpectedIssues = [...new Set(issues)].filter((issue) => !issue.includes("favicon.ico"));
console.log(JSON.stringify({ viewportResults, english, ctaRoute, admin: { adminLogin, adminSave, dbAfterSave, publicSync, adminRestore, dbAfterRestore, publicRestore }, productionRequests, unexpectedIssues }, null, 2));
await send("Page.close");
socket.close();
