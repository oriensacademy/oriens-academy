const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9223";
const pageInfo = await fetch(`${endpoint}/json/new?http://localhost:3000/tr/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
const pending = new Map();
const eventWaiters = new Map();
let id = 0;
const issues = [];

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  const waiters = eventWaiters.get(message.method) || [];
  eventWaiters.delete(message.method);
  waiters.forEach((resolve) => resolve(message.params));
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) issues.push(`log:${message.params.entry.level}:${message.params.entry.text}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") issues.push(`console:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
  if (message.method === "Network.loadingFailed" && !message.params.canceled) issues.push(`network:${message.params.errorText}:${message.params.type}`);
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) issues.push(`http:${message.params.response.status}:${message.params.response.url}`);
});

function send(method, params = {}) {
  const commandId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}

function waitFor(method, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${method}`)), timeout);
    const wrapped = (value) => { clearTimeout(timer); resolve(value); };
    eventWaiters.set(method, [...(eventWaiters.get(method) || []), wrapped]);
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(url, width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  const loaded = waitFor("Page.loadEventFired");
  await send("Page.navigate", { url });
  await loaded;
  await pause(1500);
  return evaluate(`(() => ({
    url: location.href,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
    h1: document.querySelector('h1')?.innerText || '',
    h1Lines: document.querySelector('h1') ? Math.round(document.querySelector('h1').getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)) : 0,
    favicon: [...document.querySelectorAll('link[rel*=icon]')].map(x => x.getAttribute('href')),
    logo: document.querySelector('header img[alt="Oriens Academy"]')?.getAttribute('src') || '',
    phoneLinks: document.querySelectorAll('a[href="tel:+905442939040"]').length,
    whatsappLinks: document.querySelectorAll('a[href="https://wa.me/905442939040"]').length,
    emailLinks: document.querySelectorAll('a[href="mailto:oriensacademy@gmail.com"]').length,
    journeyCards: document.querySelectorAll('#how-it-works li').length,
    concernButtons: document.querySelectorAll('#student-questions button[aria-pressed]').length,
    testimonialCards: document.querySelectorAll('#results article').length,
    languageLabels: [...document.querySelectorAll('header [role="group"] a')].map(x => x.textContent.trim()),
    loaderVisible: !!document.querySelector('[role="status"] img[src*="oriens-icon"]'),
  }))()`);
}

await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);

const results = [];
for (const [width, height] of [[360,800],[375,812],[390,844],[430,932],[768,1024],[1280,800],[1440,900],[1920,1080]]) {
  results.push({ route: "/tr/", ...(await navigate("http://localhost:3000/tr/", width, height)) });
}
results.push({ route: "/en/", ...(await navigate("http://localhost:3000/en/", 390, 844)) });
results.push({ route: "/en/", ...(await navigate("http://localhost:3000/en/", 1440, 900)) });
results.push({ route: "/tr/iletisim/", ...(await navigate("http://localhost:3000/tr/iletisim/", 390, 844)) });
results.push({ route: "/en/contact/", ...(await navigate("http://localhost:3000/en/contact/", 1440, 900)) });
results.push({ route: "/tr/privacy/", ...(await navigate("http://localhost:3000/tr/privacy/", 390, 844)) });
results.push({ route: "/en/terms/", ...(await navigate("http://localhost:3000/en/terms/", 1440, 900)) });
for (const route of [
  "/tr/sinavlar/", "/en/exams/", "/tr/sinavlar/sat/", "/en/exams/sat/",
  "/tr/universite-destegi/", "/en/university-support/", "/tr/ucretler/", "/en/pricing/",
  "/tr/hakkimizda/", "/en/about/", "/tr/randevu/", "/en/booking/",
  "/admin/login", "/admin/forgot-password", "/admin", "/admin/icerik"
]) {
  results.push({ route, ...(await navigate(`http://localhost:3000${route}`, route.startsWith("/en/") ? 1440 : 390, route.startsWith("/en/") ? 900 : 844)) });
}

await navigate("http://localhost:3000/tr/iletisim/", 390, 844);
const contactValidation = await evaluate(`(async () => { const form=document.querySelector('form'); if(!form) return {form:false}; form.querySelector('button[type="submit"]')?.click(); await new Promise(r=>setTimeout(r,150)); return {form:true,alerts:[...form.querySelectorAll('p')].filter(x=>getComputedStyle(x).color.includes('rgb')).map(x=>x.textContent.trim()).filter(Boolean).length,invalid:form.querySelectorAll('[class*=destructive]').length}; })()`);

await navigate("http://localhost:3000/tr/", 390, 844);
const concernInteraction = await evaluate(`(async () => { const button=document.querySelector('#student-questions button[aria-pressed]'); if(!button) return false; button.scrollIntoView(); button.click(); await new Promise(r=>setTimeout(r,350)); return !!document.querySelector('#student-questions [aria-pressed="true"]'); })()`);
const mobileMenu = await evaluate(`(async () => { const button=document.querySelector('header button[aria-expanded]'); if(!button) return {opened:false}; button.click(); await new Promise(r=>setTimeout(r,300)); const opened=button.getAttribute('aria-expanded')==='true' && !!document.querySelector('[role="dialog"]'); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await new Promise(r=>setTimeout(r,250)); return {opened,closed:button.getAttribute('aria-expanded')==='false'}; })()`);

await navigate("http://localhost:3000/tr/", 1440, 900);
const languageSwitch = await evaluate(`(async () => { const link=[...document.querySelectorAll('header [role="group"] a')].find(x=>x.textContent.trim()==='EN'); if(!link) return {clicked:false}; link.click(); await new Promise(r=>setTimeout(r,900)); return {clicked:true,path:location.pathname,labels:[...document.querySelectorAll('header [role="group"] a')].map(x=>x.textContent.trim())}; })()`);

console.log(JSON.stringify({ results, interactions: { concernInteraction, mobileMenu, languageSwitch, contactValidation }, issues: [...new Set(issues)] }, null, 2));
socket.close();
