import { writeFile } from "node:fs/promises";

const endpoint = "http://127.0.0.1:9223";
const pageInfo = await fetch(`${endpoint}/json/new?http://localhost:3000/tr/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
const pending = new Map();
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
async function navigate(route, width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await pause(1800);
}

await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);

async function submitForm({ route, width, height, formSelector, values, expectedSuccess }) {
  await navigate(route, width, height);
  return evaluate(`(async()=>{
    const set=(el,value)=>{const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;const setter=Object.getOwnPropertyDescriptor(proto,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};
    const form=document.querySelector(${JSON.stringify(formSelector)});
    if(!form)return {form:false,path:location.pathname};
    for(const [selector,value] of Object.entries(${JSON.stringify(values)})){const el=document.querySelector(selector);if(el)set(el,value);}
    const consent=form.querySelector('input[type="checkbox"]');if(consent&&!consent.checked)consent.click();
    for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,250));if(form.querySelector('iframe[src*="challenges.cloudflare.com"]'))break;}
    await new Promise(r=>setTimeout(r,1800));
    form.requestSubmit();
    for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,300));if(document.body.innerText.includes(${JSON.stringify(expectedSuccess)}))break;}
    const body=document.body.innerText;
    const successNode=[...document.querySelectorAll('p,h1,h2')].find(node=>(node.textContent||'').trim()===${JSON.stringify(expectedSuccess)});
    successNode?.scrollIntoView({block:'center'});await new Promise(r=>setTimeout(r,300));
    const links=[...document.querySelectorAll('a')];
    return {form:true,path:location.pathname,success:body.includes(${JSON.stringify(expectedSuccess)}),whatsapp:links.find(a=>a.href.startsWith('https://wa.me/'))?.href||'',call:links.find(a=>a.href.startsWith('tel:'))?.getAttribute('href')||'',newRequest:[...document.querySelectorAll('button')].some(b=>/Yeni Talep Oluştur|Create a New Request/.test(b.textContent||'')),overflow:document.documentElement.scrollWidth>innerWidth,alert:document.querySelector('[role="alert"]')?.textContent?.trim()||''};
  })()`);
}

const trHome = await submitForm({ route: "/tr/", width: 390, height: 844, formSelector: 'form[data-form-id="consultation-request"]', values: { '#consultation-name': 'Oriens Browser Test TR', '#consultation-email': 'mertomeroglu7@gmail.com', '#consultation-phone': '+905442939040', '#consultation-message': 'Yerel kontrollü tarayıcı testi.' }, expectedSuccess: 'Talebiniz alındı.' });
const trShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
await writeFile("test-results/contact-success-tr-390.png", Buffer.from(trShot.data, "base64"));
const trReset = await evaluate(`(async()=>{const button=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Yeni Talep Oluştur'));button?.click();await new Promise(r=>setTimeout(r,250));return{form:!!document.querySelector('form[data-form-id="consultation-request"]'),name:document.querySelector('#consultation-name')?.value||'',success:document.body.innerText.includes('Talebiniz alındı.')};})()`);

const enContact = await submitForm({ route: "/en/contact/", width: 430, height: 932, formSelector: "form", values: { '#fullName': 'Oriens Browser Test EN', '#email': 'mertomeroglu7@gmail.com', '#phone': '+905442939040', '#subject': 'SAT browser test', '#message': 'Controlled local browser submission.' }, expectedSuccess: 'Request received.' });
const enShot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
await writeFile("test-results/contact-success-en-430.png", Buffer.from(enShot.data, "base64"));
const enReset = await evaluate(`(async()=>{const button=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes('Create a New Request'));button?.click();await new Promise(r=>setTimeout(r,250));return{form:!!document.querySelector('form'),name:document.querySelector('#fullName')?.value||'',success:document.body.innerText.includes('Request received.')};})()`);

const about = [];
for (const [route, width, height] of [["/tr/hakkimizda/",360,800],["/tr/hakkimizda/",390,844],["/en/about/",430,932],["/en/about/",1440,900]]) {
  await navigate(route, width, height);
  about.push(await evaluate(`({path:location.pathname,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,circular:!!document.querySelector('[aria-roledescription="carousel"]'),body:document.body.innerText.slice(0,120)})`));
}

const uniqueIssues = [...new Set(issues)].filter((issue) => !issue.includes("challenges.cloudflare.com") && !issue.includes("cdn-cgi/challenge-platform"));
const productionRequests = [...new Set(requests)].filter((url) => /https:\/\/[^/]*\.supabase\.co/i.test(url));
console.log(JSON.stringify({ trHome, trReset, enContact, enReset, about, productionRequests, unexpectedIssues: uniqueIssues }, null, 2));
await send("Page.close");
socket.close();
