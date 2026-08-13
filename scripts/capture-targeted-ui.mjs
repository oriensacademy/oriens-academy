import { mkdir, writeFile } from "node:fs/promises";

const endpoint = "http://127.0.0.1:9223";
const target = await fetch(`${endpoint}/json/new?http://localhost:3000/tr/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const task = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
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
  return result.result.value;
}
async function shot(name, route, width, height, selector) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await pause(2400);
  await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  await pause(500);
  const data = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(`test-results/${name}.png`, Buffer.from(data.data, "base64"));
}

await mkdir("test-results", { recursive: true });
await Promise.all([send("Page.enable"), send("Runtime.enable")]);
await send("Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem('oriens-loader-seen','1')` });
await shot("targeted-globe-desktop", "/tr/", 1440, 900, "[data-study-destination-section]");
await shot("targeted-concerns-mobile", "/en/", 390, 844, "[data-concern-pile]");
await shot("targeted-contact-desktop", "/tr/iletisim/", 1440, 900, "form");
await shot("targeted-contact-mobile", "/en/contact/", 390, 844, "form");
await send("Page.close");
socket.close();
