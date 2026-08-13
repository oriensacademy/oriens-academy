import { writeFile } from "node:fs/promises";

const endpoint = "http://127.0.0.1:9223";
const pageInfo = await fetch(`${endpoint}/json/new?http://localhost:3000/tr/sinavlar/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
const pending = new Map();
let id = 0;
const issues = [];

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
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) issues.push(`log:${message.params.entry.level}:${message.params.entry.text}`);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") issues.push(`console:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
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

async function navigate(route, width, height, label) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await pause(1800);
  return evaluate(`(async () => {
    const target = document.querySelector('[role="img"][aria-label="${label}"]');
    target?.scrollIntoView({block:'center'});
    await new Promise(r => setTimeout(r, 900));
    const canvas = target?.querySelector('canvas');
    const signature = () => {
      if (!canvas || !canvas.width || !canvas.height) return null;
      const data = canvas.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;
      if (!data) return null;
      let hash = 2166136261;
      for (let i=0; i<data.length; i+=97) hash = Math.imul(hash ^ data[i], 16777619);
      return hash >>> 0;
    };
    const first = signature();
    await new Promise(r => setTimeout(r, 700));
    const second = signature();
    const rect = target?.getBoundingClientRect();
    return {
      route: location.pathname,
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      found: !!target,
      canvas: !!canvas,
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      renderedWidth: rect ? Math.round(rect.width) : 0,
      renderedHeight: rect ? Math.round(rect.height) : 0,
      frameChanged: first !== null && first !== second,
      first,
      second,
    };
  })()`);
}

await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);

const cases = [
  ["/tr/sinavlar/", 360, 800, "Uluslararası sınav hazırlığı animasyonu"],
  ["/tr/sinavlar/", 1440, 900, "Uluslararası sınav hazırlığı animasyonu"],
  ["/tr/", 390, 844, "Kişiselleştirilmiş öğrenme ve akademik destek animasyonu"],
  ["/en/", 430, 932, "Personalized learning and academic support animation"],
  ["/tr/sinavlar/tmua/", 390, 844, "TMUA nicel akıl yürütme animasyonu"],
  ["/en/exams/ompt/", 1440, 900, "OMPT mathematics preparation animation"],
  ["/tr/sinavlar/esat/", 430, 932, "ESAT fen ve mühendislik hazırlık animasyonu"],
  ["/en/exams/imat/", 1440, 900, "IMAT chemistry and science preparation animation"],
];
const results = [];
for (const entry of cases) {
  const result = await navigate(...entry);
  results.push(result);
  const captureNames = {
    "/tr/": "lottie-learning-390.png",
    "/tr/sinavlar/tmua/": "lottie-calculator-390.png",
    "/tr/sinavlar/esat/": "lottie-science-430.png",
  };
  const captureName = captureNames[entry[0]];
  if (captureName) {
    const capture = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    await writeFile(`test-results/${captureName}`, Buffer.from(capture.data, "base64"));
  }
}

await navigate("/tr/sinavlar/", 1440, 900, "Uluslararası sınav hazırlığı animasyonu");
const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/lottie-exams-hub-1440.png", Buffer.from(screenshot.data, "base64"));
const offscreenPause = await evaluate(`(async () => {
  const target = document.querySelector('[role="img"][aria-label="Uluslararası sınav hazırlığı animasyonu"]');
  const canvas = target?.querySelector('canvas');
  const signature = () => {
    if (!canvas) return null;
    const data = canvas.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;
    let hash = 2166136261;
    if (!data) return null;
    for (let i=0; i<data.length; i+=97) hash = Math.imul(hash ^ data[i], 16777619);
    return hash >>> 0;
  };
  window.scrollTo(0, document.documentElement.scrollHeight);
  await new Promise(r => setTimeout(r, 700));
  const first = signature();
  await new Promise(r => setTimeout(r, 700));
  const second = signature();
  return { first, second, paused: first !== null && first === second };
})()`);

await navigate("/tr/sinavlar/imat/", 390, 844, "IMAT kimya ve fen hazırlık animasyonu");
const mobileScreenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
await writeFile("test-results/lottie-imat-390.png", Buffer.from(mobileScreenshot.data, "base64"));

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const reducedMotion = await navigate("/tr/sinavlar/esat/", 390, 844, "ESAT fen ve mühendislik hazırlık animasyonu");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });

const assetChecks = {};
for (const file of ["science", "learning", "green-calculator", "erlenmeyer-flask", "exams-preparation"]) {
  assetChecks[file] = await fetch(`http://localhost:3000/animations/${file}.lottie`).then((response) => ({ status: response.status, type: response.headers.get("content-type"), bytes: Number(response.headers.get("content-length") || 0) }));
}

console.log(JSON.stringify({ results, offscreenPause, reducedMotion, assetChecks, issues: [...new Set(issues)] }, null, 2));
await send("Page.close");
socket.close();
