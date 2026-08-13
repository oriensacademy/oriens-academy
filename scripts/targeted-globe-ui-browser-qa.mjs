const endpoint = "http://127.0.0.1:9223";
const target = await fetch(`${endpoint}/json/new?http://localhost:3000/tr/`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const waiters = new Map();
const issues = [];
const failedRequests = [];
let commandId = 0;

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
  const eventTasks = waiters.get(message.method) || [];
  waiters.delete(message.method);
  eventTasks.forEach((resolve) => resolve(message.params));
  if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) issues.push(`console:${message.params.type}:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) issues.push(`log:${message.params.entry.level}:${message.params.entry.text}`);
  if (message.method === "Network.responseReceived" && message.params.response.status >= 400) failedRequests.push(`${message.params.response.status}:${message.params.response.url}`);
  if (message.method === "Network.loadingFailed" && !message.params.canceled) failedRequests.push(`${message.params.errorText}:${message.params.type}`);
});

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function navigate(route, width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  const loaded = waitFor("Page.loadEventFired");
  await send("Page.navigate", { url: `http://localhost:3000${route}` });
  await loaded;
  await pause(2200);
  return evaluate(`(() => {
    const logo = document.querySelector('header img[alt="Oriens Academy"]');
    const header = document.querySelector('header');
    const pile = document.querySelector('[data-concern-pile]');
    const booking = document.querySelector('#booking > div');
    return {
      route: location.pathname,
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
      logoWidth: logo ? Math.round(logo.getBoundingClientRect().width) : 0,
      languages: [...document.querySelectorAll('header [role="group"] a')].map((node) => node.textContent.trim()),
      menuTrigger: !!document.querySelector('header button[aria-expanded]'),
      concernCount: pile?.querySelectorAll('button[aria-pressed]').length || 0,
      concernPosition: pile?.querySelector('button') ? getComputedStyle(pile.querySelector('button')).position : '',
      globeReady: document.querySelector('[data-study-globe]')?.getAttribute('data-globe-ready') || '',
      countryCount: document.querySelectorAll('[data-country-layer] path').length,
      dottedCanvas: document.querySelectorAll('[data-study-destination-section] canvas').length,
      bookingColumns: booking ? getComputedStyle(booking).gridTemplateColumns : '',
      turnstileWarning: /development mode|test key|test anahtar/i.test(document.body.innerText),
    };
  })()`);
}

await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);
await send("Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem('oriens-loader-seen','1')` });

const viewports = [[360, 800], [390, 844], [430, 932], [768, 1024], [1280, 800], [1440, 900], [1920, 1080]];
const results = [];
for (const [width, height] of viewports) results.push(await navigate("/tr/", width, height));
results.push(await navigate("/en/", 390, 844));
results.push(await navigate("/en/", 1440, 900));
results.push(await navigate("/tr/iletisim/", 390, 844));
results.push(await navigate("/en/contact/", 1440, 900));

await navigate("/tr/", 1440, 900);
const interactions = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pileButton = document.querySelector('[data-concern-pile] button[aria-pressed]');
  pileButton?.click();
  await sleep(350);
  const concern = {
    selected: pileButton?.getAttribute('aria-pressed') === 'true',
    answerVisible: !!document.querySelector('[data-concern-pile] + div'),
  };

  const globe = document.querySelector('[data-study-globe]');
  globe?.scrollIntoView({ block: 'center' });
  await sleep(500);
  const uk = document.querySelector('[data-country-layer] path[aria-label="United Kingdom"]');
  uk?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  await sleep(220);
  const ukHoverFill = uk?.getAttribute('fill');
  const hoverLabel = !![...globe.querySelectorAll('text')].find((node) => /Birleşik Krallık|United Kingdom/.test(node.textContent || ''));
  uk?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await sleep(1050);
  const ukSelected = globe?.getAttribute('data-selected-region');
  const ukFocused = globe?.getAttribute('data-focus-complete');
  const beforeDrag = globe?.getAttribute('data-rotation');
  const svg = globe?.querySelector('svg');
  if (svg) {
    const box = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: box.left + box.width / 2 + 55, clientY: box.top + box.height / 2 + 8 }));
    svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: box.left + box.width / 2 + 55, clientY: box.top + box.height / 2 + 8 }));
  }
  await sleep(150);
  const afterDrag = globe?.getAttribute('data-rotation');
  const selectorButtons = [...document.querySelectorAll('[data-study-destination-section] [role="group"] button')];
  const usaButton = selectorButtons.find((node) => /Amerika|United States/.test(node.textContent || ''));
  usaButton?.click();
  await sleep(1050);
  const usSelected = globe?.getAttribute('data-selected-region');

  return { concern, globe: { ukFound: !!uk, ukHoverFill, hoverLabel, ukSelected, ukFocused, beforeDrag, afterDrag, dragged: beforeDrag !== afterDrag, usSelected, countryCount: globe?.querySelectorAll('[data-country-layer] path').length || 0 } };
})()`);

await navigate("/tr/", 390, 844);
const mobileDrag = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const globe = document.querySelector('[data-study-globe]');
  globe?.scrollIntoView({ block: 'center' });
  await sleep(400);
  const before = globe?.getAttribute('data-rotation');
  const svg = globe?.querySelector('svg');
  if (svg) {
    const box = svg.getBoundingClientRect();
    svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: box.left + 150, clientY: box.top + 150 }));
    svg.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: box.left + 196, clientY: box.top + 158 }));
    svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'touch', clientX: box.left + 196, clientY: box.top + 158 }));
  }
  await sleep(150);
  const after = globe?.getAttribute('data-rotation');
  return { before, after, changed: before !== after, touchAction: svg ? getComputedStyle(svg).touchAction : '' };
})()`);

await navigate("/tr/", 1440, 900);
const beforeLanguage = await evaluate(`(() => {
  window.__oriensTransitionSamples = [];
  window.__oriensSampler = setInterval(() => {
    window.__oriensTransitionSamples.push({
      path: location.pathname,
      logoLoader: !!document.querySelector('[role="status"] img[src*="oriens-icon"]'),
      wave: !!document.querySelector('[role="status"][aria-label="Loading language"]'),
      bodyOpacity: getComputedStyle(document.body).opacity,
      mainOpacity: document.querySelector('main') ? getComputedStyle(document.querySelector('main')).opacity : '',
    });
  }, 25);
  const en = [...document.querySelectorAll('header [role="group"] a')].find((node) => node.textContent.trim() === 'EN');
  en?.click();
  return { clicked: !!en };
})()`);
await pause(1400);
const language = await evaluate(`(() => {
  clearInterval(window.__oriensSampler);
  const samples = window.__oriensTransitionSamples || [];
  return {
    path: location.pathname,
    logoLoaderSeen: samples.some((sample) => sample.logoLoader),
    waveSeen: samples.some((sample) => sample.wave),
    blankSeen: samples.some((sample) => sample.bodyOpacity === '0' || sample.mainOpacity === '0'),
    samples: samples.length,
  };
})()`);

const unexpectedIssues = [...new Set(issues)].filter((issue) => !issue.includes("favicon.ico") && !issue.includes("challenges.cloudflare.com"));
const unexpectedFailedRequests = [...new Set(failedRequests)].filter((item) => !item.includes("challenges.cloudflare.com"));
console.log(JSON.stringify({ results, interactions: { ...interactions, mobileDrag }, language: { ...beforeLanguage, ...language }, unexpectedIssues, unexpectedFailedRequests }, null, 2));
await send("Page.close");
socket.close();
