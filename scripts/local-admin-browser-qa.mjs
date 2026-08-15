import { writeFile } from "node:fs/promises";

const adminEmail = process.env.ORIENS_LOCAL_ADMIN_EMAIL;
const adminPassword = process.env.ORIENS_LOCAL_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) throw new Error("Explicit local admin QA credentials are required.");

const endpoint = "http://127.0.0.1:9223";
const pageInfo = await fetch(`${endpoint}/json/new?http://localhost:3000/admin/login/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
const issues = [];
const requests = [];

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
    return;
  }
  if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") issues.push(`console:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") issues.push(`log:${message.params.entry.text}`);
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) issues.push(`http:${message.params.response.status}:${message.params.response.url}`);
});

function send(method, params = {}) {
  const commandId = ++id;
  return new Promise((resolve, reject) => {
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function navigate(route, width = 1440, height = 900) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await pause(1300);
  return evaluate(`({path:location.pathname,title:document.title,h1:document.querySelector('h1')?.textContent?.trim()||'',main:!!document.querySelector('main'),overflow:document.documentElement.scrollWidth>innerWidth,body:document.body.innerText.slice(0,300)})`);
}

await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);

await navigate("/admin/login/", 1440, 900);
const initial = await evaluate(`({email:document.querySelector('#admin-email')?.value,password:document.querySelector('#admin-password')?.value,form:!!document.querySelector('form')})`);

const invalid = await evaluate(`(async()=>{
  const set=(el,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  set(document.querySelector('#admin-email'),${JSON.stringify(adminEmail)});
  set(document.querySelector('#admin-password'),'WrongPassword#1');
  document.querySelector('form').requestSubmit();
  await new Promise(r=>setTimeout(r,1500));
  return {path:location.pathname,alert:document.querySelector('[role="alert"]')?.textContent?.trim()||''};
})()`);

const valid = await evaluate(`(async()=>{
  const set=(el,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
  set(document.querySelector('#admin-email'),${JSON.stringify(adminEmail)});
  set(document.querySelector('#admin-password'),${JSON.stringify(adminPassword)});
  document.querySelector('form').requestSubmit();
  for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,350));if(location.pathname==='/admin/')break;}
  await new Promise(r=>setTimeout(r,900));
  return {path:location.pathname,h1:document.querySelector('h1')?.textContent?.trim()||'',email:document.body.innerText.includes(${JSON.stringify(adminEmail)}),profile:document.body.innerText.includes('Oriens Local Administrator')};
})()`);

const dashboardCapture = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/local-admin-dashboard-1440.png", Buffer.from(dashboardCapture.data, "base64"));

await send("Page.reload", { ignoreCache: false });
await pause(1800);
const refresh = await evaluate(`({path:location.pathname,authenticated:document.body.innerText.includes(${JSON.stringify(adminEmail)}),h1:document.querySelector('h1')?.textContent?.trim()||''})`);

const routes = ["/admin/", "/admin/randevular/", "/admin/iletisim/", "/admin/musaitlik/", "/admin/fiyatlandirma/", "/admin/icerik/", "/admin/bildirimler/", "/admin/denetim/", "/admin/ayarlar/"];
const routeResults = [];
for (const route of routes) routeResults.push({ expected: route, ...(await navigate(route)) });

await navigate("/admin/", 390, 844);
const mobile = await evaluate(`(async()=>{
  const menu=document.querySelector('button[aria-label="Toggle navigation menu"]');
  menu?.click();
  await new Promise(r=>setTimeout(r,200));
  const drawerElement=document.querySelector('.fixed.inset-y-0 aside');
  const drawer=!!drawerElement;
  const links=drawerElement?[...drawerElement.querySelectorAll('a')]:[];
  const settings=links.find(x=>x.getAttribute('href')==='/admin/ayarlar');
  settings?.click();
  await new Promise(r=>setTimeout(r,1200));
  return {menu:!!menu,drawer,links:links.length,path:location.pathname,overflow:document.documentElement.scrollWidth>innerWidth};
})()`);
const mobileCapture = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/local-admin-mobile-390.png", Buffer.from(mobileCapture.data, "base64"));

const logout = await evaluate(`(async()=>{
  const button=document.querySelector('button[title*="Oturumu Kapat"]');
  button?.click();
  for(let i=0;i<25;i++){await new Promise(r=>setTimeout(r,250));if(location.pathname==='/admin/login/')break;}
  return {button:!!button,path:location.pathname};
})()`);
const protectedAfterLogout = await navigate("/admin/fiyatlandirma/", 390, 844);
await pause(800);
protectedAfterLogout.finalPath = await evaluate("location.pathname");

const uniqueRequests = [...new Set(requests)];
const productionRequests = uniqueRequests.filter((url) => /https:\/\/[^/]*\.supabase\.co/i.test(url));
const supabaseRequests = uniqueRequests.filter((url) => /(?:127\.0\.0\.1|localhost):54321/.test(url));
const expectedInvalidAuthErrors = issues.filter((issue) => issue.includes("/auth/v1/token?grant_type=password") && issue.includes("400"));
const unexpectedIssues = [...new Set(issues)].filter((issue) => !expectedInvalidAuthErrors.includes(issue) && issue !== "log:Failed to load resource: the server responded with a status of 400 (Bad Request)");

console.log(JSON.stringify({ initial, invalid, valid, refresh, routeResults, mobile, logout, protectedAfterLogout, network: { productionRequests, localSupabaseRequestCount: supabaseRequests.length, localSupabaseHosts: [...new Set(supabaseRequests.map((url)=>new URL(url).host))] }, expectedInvalidAuthErrors, unexpectedIssues }, null, 2));
await send("Page.close");
socket.close();
