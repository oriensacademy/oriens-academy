import { writeFile } from "node:fs/promises";

const page = await fetch("http://127.0.0.1:9223/json/new?http://localhost:3000/tr/randevu/", { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const issues = [];
let id = 0;
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { const task = pending.get(message.id); pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); return; }
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") issues.push(`console:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) issues.push(`http:${message.params.response.status}:${message.params.response.url}`);
});
function send(method, params = {}) { const commandId = ++id; return new Promise((resolve, reject) => { pending.set(commandId, { resolve, reject }); socket.send(JSON.stringify({ id: commandId, method, params })); }); }
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; }
await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Network.enable")]);
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Page.navigate", { url: "http://localhost:3000/tr/randevu/" });
await new Promise((resolve) => setTimeout(resolve, 2200));

const result = await evaluate(`(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const button=text=>[...document.querySelectorAll('button')].find(node=>(node.textContent||'').includes(text));
  const general=document.querySelector('input[value="general_consultation"]');general?.click();await wait(150);button('Devam Et')?.click();await wait(300);
  for(let i=0;i<20;i++){if([...document.querySelectorAll('button')].some(node=>node.querySelector('svg.lucide-clock')))break;await wait(250);}
  const slot=[...document.querySelectorAll('button')].find(node=>node.querySelector('svg.lucide-clock'));slot?.click();await wait(200);button('Devam Et')?.click();await wait(250);
  const set=(el,value)=>{if(!el)return false;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));return true;};
  set(document.querySelector('#fullName'),'Oriens Booking Browser Test TR');set(document.querySelector('#email'),'mertomeroglu7@gmail.com');set(document.querySelector('#phone'),'+905442939040');
  const consent=document.querySelector('input[type="checkbox"]');if(consent&&!consent.checked)consent.click();await wait(150);button('Devam Et')?.click();await wait(500);
  await wait(1800);button('Randevu Talebini Onayla ve Gönder')?.click();
  for(let i=0;i<45;i++){await wait(300);if(document.body.innerText.includes('Talebiniz alındı.'))break;}
  const success=[...document.querySelectorAll('h1')].find(node=>(node.textContent||'').includes('Talebiniz alındı.'));success?.scrollIntoView({block:'center'});await wait(250);
  const links=[...document.querySelectorAll('a')];
  return {success:document.body.innerText.includes('Talebiniz alındı.'),whatsapp:links.find(a=>(a.textContent||'').includes('WhatsApp'))?.href||'',call:links.find(a=>a.getAttribute('href')?.startsWith('tel:'))?.getAttribute('href')||'',newRequest:!!button('Yeni Talep Oluştur'),overflow:document.documentElement.scrollWidth>innerWidth,alert:document.querySelector('[role="alert"]')?.textContent?.trim()||'',body:document.body.innerText.slice(0,600),path:location.pathname};
})()`);
const capture = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/booking-success-tr-390.png", Buffer.from(capture.data, "base64"));
const reset = await evaluate(`(async()=>{const button=[...document.querySelectorAll('button')].find(node=>(node.textContent||'').includes('Yeni Talep Oluştur'));button?.click();await new Promise(r=>setTimeout(r,500));return{fresh:document.body.innerText.includes('Öncelikli akademik hedefiniz nedir?'),success:document.body.innerText.includes('Talebiniz alındı.')};})()`);
console.log(JSON.stringify({ result, reset, unexpectedIssues: [...new Set(issues)].filter((issue) => !issue.includes('challenges.cloudflare.com')) }, null, 2));
await send("Page.close");socket.close();
