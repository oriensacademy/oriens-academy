import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const baseUrl = "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profilePath = await mkdtemp(path.join(tmpdir(), "oriens-visual-qa-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profilePath}`,
  "--no-first-run",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let commandId = 0;
let devtoolsHttpBase = "";
const pending = new Map();
const waiters = new Map();
const issues = [];
const failedRequests = [];
const faviconResponses = [];
const lottieResponses = [];

async function waitForChrome() {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Chrome DevTools endpoint did not start")), 10_000);
    chrome.stderr.on("data", (chunk) => {
      const match = chunk.toString().match(/DevTools listening on ws:\/\/(\[[^\]]+\]|[^:]+):(\d+)\//);
      if (!match) return;
      clearTimeout(timer);
      devtoolsHttpBase = `http://${match[1]}:${match[2]}`;
      resolve();
    });
    chrome.once("error", reject);
    chrome.once("exit", (code) => reject(new Error(`Chrome exited before DevTools started (${code})`)));
  });
}

function send(method, params = {}) {
  const id = ++commandId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function waitForEvent(method, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
    const wrapped = (value) => { clearTimeout(timer); resolve(value); };
    waiters.set(method, [...(waiters.get(method) || []), wrapped]);
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitUntil(expression, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function navigate(route, width = 1440, height = 900) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const loaded = waitForEvent("Page.loadEventFired");
  await send("Page.navigate", { url: `${baseUrl}${route}` });
  await loaded;
  await pause(1_100);
  return evaluate(`(() => ({
    requested: ${JSON.stringify(route)},
    path: location.pathname,
    width: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
    favicon: [...document.querySelectorAll('link[rel~="icon"]')].map((node) => node.getAttribute('href')),
    h1: document.querySelector('h1')?.innerText || '',
  }))()`);
}

async function clickAt(x, y, dragX = 0, dragY = 0) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  if (dragX || dragY) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + dragX, y: y + dragY, button: "left", buttons: 1 });
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dragX, y: y + dragY, button: "left", clickCount: 1 });
}

try {
  await waitForChrome();
  const pageInfo = await fetch(`${devtoolsHttpBase}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  socket = new WebSocket(pageInfo.webSocketDebuggerUrl);
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
    for (const resolve of waiters.get(message.method) || []) resolve(message.params);
    waiters.delete(message.method);
    if (message.method === "Runtime.exceptionThrown") issues.push(`exception:${message.params.exceptionDetails?.text || "unknown"}`);
    if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) issues.push(`console:${message.params.type}:${message.params.args.map((arg) => arg.value || arg.description || "").join(" ")}`);
    if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) issues.push(`log:${message.params.entry.level}:${message.params.entry.text}`);
    if (message.method === "Network.responseReceived") {
      const { response } = message.params;
      if (response.status >= 400) failedRequests.push(`${response.status}:${response.url}`);
      if (/\/icon\.png(?:\?|$)/.test(response.url)) faviconResponses.push({ url: response.url, status: response.status, mimeType: response.mimeType });
      if (/\/animations\/[^?]+\.lottie(?:\?|$)/.test(response.url)) lottieResponses.push({ url: response.url, status: response.status });
    }
  });
  await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Log.enable"), send("Network.enable")]);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `sessionStorage.setItem('oriens-loader-seen','1')` });

  const routes = [
    ["/tr/", 390], ["/en/", 1440], ["/tr/sinavlar/", 390], ["/en/exams/", 1440],
    ["/tr/universite-destegi/", 390], ["/en/university-support/", 1440],
    ["/tr/ucretler/", 390], ["/en/pricing/", 1440],
    ["/tr/hakkimizda/", 390], ["/en/about/", 1440], ["/admin/login", 390], ["/admin", 1440],
    ["/admin/randevular", 390], ["/admin/ayarlar", 1440],
    ["/tr/sinavlar/tmua/", 390], ["/tr/sinavlar/esat/", 390], ["/tr/sinavlar/imat/", 390],
  ];
  const routeResults = [];
  for (const [route, width] of routes) routeResults.push(await navigate(route, width, width < 768 ? 844 : 900));
  for (const result of routeResults) {
    if (result.overflow) {
      await navigate(result.requested, result.width, result.width < 768 ? 844 : 900);
      const offenders = await evaluate(`([...document.querySelectorAll('body *')].map((node) => { const rect=node.getBoundingClientRect(); return { tag:node.tagName, id:node.id, className:typeof node.className==='string'?node.className.slice(0,160):'', text:(node.textContent||'').trim().slice(0,100), parent:node.parentElement?.tagName+':'+(typeof node.parentElement?.className==='string'?node.parentElement.className.slice(0,120):''), left:Math.round(rect.left), right:Math.round(rect.right), width:Math.round(rect.width) }; }).filter((item) => item.left < -1 || item.right > innerWidth + 1).slice(0,20))`);
      assert.fail(`${result.requested}: horizontal overflow ${JSON.stringify(offenders)}`);
    }
    const faviconPaths = [...new Set(result.favicon)];
    assert.equal(faviconPaths.length, 1, `${result.requested}: multiple favicon sources ${JSON.stringify(faviconPaths)}`);
    assert.match(faviconPaths[0], /^\/icon\.png\?/, `${result.requested}: unexpected favicon`);
  }

  await navigate("/tr/", 1440, 900);
  const homeVisuals = await evaluate(`(() => {
    const dock = document.querySelector('[data-contact-dock]');
    const panel = document.querySelector('[data-subject-panel]');
    const footerIcons = [...document.querySelectorAll('footer ul a > span:first-child')];
    return {
      dockVisible: !!dock && getComputedStyle(dock).display !== 'none',
      subjectCount: panel?.querySelectorAll('[role="listitem"]').length || 0,
      subjectColumns: panel ? getComputedStyle(panel).gridTemplateColumns.split(' ').length : 0,
      footerIconSizes: footerIcons.slice(0, 4).map((node) => Math.round(node.getBoundingClientRect().width)),
      footerSharedLanguageSwitch: document.querySelectorAll('footer [role="group"] a').length === 2,
    };
  })()`);
  assert.equal(homeVisuals.dockVisible, true);
  assert.equal(homeVisuals.subjectCount, 6);
  assert.equal(homeVisuals.subjectColumns, 3);
  assert.deepEqual(homeVisuals.footerIconSizes, [40, 40, 40, 40]);
  assert.equal(homeVisuals.footerSharedLanguageSwitch, true);

  const mobileVisuals = [];
  for (const width of [360, 390, 430]) {
    await navigate("/tr/", width, 844);
    mobileVisuals.push(await evaluate(`(() => {
      const dock = document.querySelector('[data-contact-dock]');
      const panel = document.querySelector('[data-subject-panel]');
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        dockHidden: !dock || getComputedStyle(dock).display === 'none',
        subjectColumns: panel ? getComputedStyle(panel).gridTemplateColumns.split(' ').length : 0,
        subjectCount: panel?.querySelectorAll('[role="listitem"]').length || 0,
      };
    })()`));
  }
  assert.equal(mobileVisuals.every((item) => item.width === 360 || item.width === 390 || item.width === 430), true);
  assert.equal(mobileVisuals.every((item) => item.dockHidden && item.subjectColumns === 2 && item.subjectCount === 6 && !item.overflow), true);

  const aboutChecks = [];
  for (const [route, width] of [["/tr/hakkimizda/", 390], ["/en/about/", 1440]]) {
    await navigate(route, width, width < 768 ? 844 : 900);
    aboutChecks.push(await evaluate(`({
      path: location.pathname,
      originalMounted: !!document.querySelector('[data-owner-component="uniquesonu/about-us-section"]'),
      stockImage: !!document.querySelector('[data-owner-component] img[src*="unsplash"]'),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    })`));
  }
  assert.equal(aboutChecks.every((item) => item.originalMounted && !item.stockImage && !item.overflow), true);

  await navigate("/tr/", 1440, 900);
  const localeBefore = await evaluate(`(() => {
    const section = document.getElementById('study-destinations');
    section.scrollIntoView({block:'start'});
    window.scrollBy(0, 170);
    const before = section.getBoundingClientRect().top;
    const link = [...document.querySelectorAll('header [role="group"] a')].find((node) => node.textContent.trim() === 'EN');
    link.click();
    return { before, clicked: !!link };
  })()`);
  await waitUntil("location.pathname === '/en/'");
  await pause(1_000);
  const localeAfter = await evaluate(`({
    path: location.pathname,
    sectionTop: document.getElementById('study-destinations')?.getBoundingClientRect().top,
    waveCleared: !document.querySelector('[data-language-wave]'),
    storedPositionCleared: !sessionStorage.getItem('oriens-locale-position'),
  })`);
  assert.ok(Math.abs(localeAfter.sectionTop - localeBefore.before) < 45, `locale section moved ${localeAfter.sectionTop - localeBefore.before}px`);
  assert.equal(localeAfter.waveCleared, true);
  assert.equal(localeAfter.storedPositionCleared, true);

  await navigate("/en/pricing/", 1440, 900);
  const pricingBefore = await evaluate(`(() => {
    const section = document.getElementById('packages');
    section.scrollIntoView({block:'start'});
    window.scrollBy(0, 120);
    const before = section.getBoundingClientRect().top;
    [...document.querySelectorAll('header [role="group"] a')].find((node) => node.textContent.trim() === 'TR').click();
    return before;
  })()`);
  await waitUntil("location.pathname === '/tr/ucretler/'");
  await pause(1_000);
  const pricingAfter = await evaluate("document.getElementById('packages')?.getBoundingClientRect().top");
  assert.ok(Math.abs(pricingAfter - pricingBefore) < 45, `pricing locale position moved ${pricingAfter - pricingBefore}px`);

  await navigate("/tr/", 1440, 900);
  await evaluate("document.getElementById('study-destinations').scrollIntoView({block:'center'})");
  await waitUntil("document.querySelector('[data-study-globe]')?.dataset.globeReady === 'true'");
  await pause(500);
  const globeStart = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  await pause(500);
  const globeAuto = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  assert.notEqual(globeStart, globeAuto, "globe did not auto-rotate");

  const canvasBox = await evaluate(`(() => { const r=document.querySelector('[data-study-globe] canvas').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: canvasBox.x, y: canvasBox.y });
  await pause(350);
  const hoverA = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  await pause(450);
  const hoverB = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  assert.equal(hoverA, hoverB, "globe did not pause on hover");
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 20, y: 20 });
  await pause(900);
  const leaveEarly = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  assert.equal(leaveEarly, hoverB, "globe resumed before delay");
  await pause(1_500);
  const leaveLate = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  assert.notEqual(leaveLate, leaveEarly, "globe did not resume after pointer leave");
  await pause(1_100);
  const activeFps = await evaluate("Number(document.querySelector('[data-study-globe]').dataset.fps)");

  const chipResults = {};
  for (const [label, id] of [["Amerika Birleşik Devletleri", "us"], ["Birleşik Krallık", "uk"]]) {
    await evaluate(`([...document.querySelectorAll('[data-study-destination-section] [role="group"] button')].find((node) => node.textContent.includes(${JSON.stringify(label)}))).click()`);
    await waitUntil(`document.querySelector('[data-study-globe]')?.dataset.focusComplete === ${JSON.stringify(id)}`);
    chipResults[id] = await evaluate("document.querySelector('[data-study-globe]').dataset.selectedRegion");
  }
  assert.deepEqual(chipResults, { us: "us", uk: "uk" });

  await evaluate(`([...document.querySelectorAll('[data-study-destination-section] [role="group"] button')].find((node) => node.textContent.includes('Amerika Birleşik Devletleri'))).click()`);
  await waitUntil("document.querySelector('[data-study-globe]')?.dataset.focusComplete === 'us'");
  const centeredBox = await evaluate(`(() => { const r=document.querySelector('[data-study-globe] canvas').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await clickAt(centeredBox.x, centeredBox.y);
  await pause(300);
  const usaPolygon = await evaluate(`({ selected:document.querySelector('[data-study-globe]').dataset.selectedRegion, source:document.querySelector('[data-study-globe]').dataset.lastSelectionSource })`);
  assert.deepEqual(usaPolygon, { selected: "us", source: "polygon" });

  await evaluate(`([...document.querySelectorAll('[data-study-destination-section] [role="group"] button')].find((node) => node.textContent.includes('Kanada'))).click()`);
  await waitUntil("document.querySelector('[data-study-globe]')?.dataset.focusComplete === 'canada'");
  await clickAt(centeredBox.x, centeredBox.y);
  await pause(300);
  const canadaPolygon = await evaluate(`({ selected:document.querySelector('[data-study-globe]').dataset.selectedRegion, source:document.querySelector('[data-study-globe]').dataset.lastSelectionSource })`);
  assert.deepEqual(canadaPolygon, { selected: "canada", source: "polygon" });

  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: centeredBox.x, y: centeredBox.y });
  const selectedBeforeLeave = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 20, y: 20 });
  await pause(2_300);
  const selectedAfterLeave = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  assert.equal(selectedAfterLeave, selectedBeforeLeave, "selected region restarted auto-rotation");

  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: centeredBox.x, y: centeredBox.y });
  const dragBefore = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  await clickAt(centeredBox.x, centeredBox.y, 65, 12);
  await pause(150);
  const dragAfter = await evaluate("document.querySelector('[data-study-globe]').dataset.rotation");
  assert.notEqual(dragBefore, dragAfter, "globe drag did not rotate");

  const globeMetrics = await evaluate(`(() => { const globe=document.querySelector('[data-study-globe]'); return { fps:${activeFps}, dpr:Number(globe.dataset.dpr), engine:globe.dataset.renderEngine, reactFrameUpdates:globe.dataset.reactFrameUpdates, dragBefore:${JSON.stringify(dragBefore)}, dragAfter:globe.dataset.rotation }; })()`);
  assert.ok(globeMetrics.fps >= 50, `globe FPS too low: ${globeMetrics.fps}`);
  assert.ok(globeMetrics.dpr <= 1.5);
  assert.equal(globeMetrics.engine, "canvas");
  assert.equal(globeMetrics.reactFrameUpdates, "false");

  const unexpectedIssues = [...new Set(issues)].filter((item) => !item.includes("challenges.cloudflare.com"));
  const unexpectedFailedRequests = [...new Set(failedRequests)].filter((item) => !item.includes("challenges.cloudflare.com"));
  assert.equal(unexpectedIssues.length, 0, unexpectedIssues.join("\n"));
  assert.equal(unexpectedFailedRequests.length, 0, unexpectedFailedRequests.join("\n"));
  assert.ok(faviconResponses.some((item) => item.status === 200 && item.mimeType.startsWith("image/")), "favicon request was not observed");
  const lottieNames = [...new Set(lottieResponses.filter((item) => item.status === 200).map((item) => new URL(item.url).pathname.split('/').pop()))];
  assert.deepEqual(lottieNames.sort(), ["erlenmeyer-flask.lottie", "exams-preparation.lottie", "green-calculator.lottie", "learning.lottie", "science.lottie"].sort());

  console.log(JSON.stringify({ routeResults, faviconResponses: [...new Map(faviconResponses.map((item) => [item.url, item])).values()], lottieNames, homeVisuals, mobileVisuals, aboutChecks, locale: { home: { before: localeBefore.before, after: localeAfter.sectionTop }, pricing: { before: pricingBefore, after: pricingAfter } }, globe: { autoRotate: true, hoverPause: true, delayedResume: true, chipResults, usaPolygon, canadaPolygon, selectedLock: true, ...globeMetrics }, issues: unexpectedIssues, failedRequests: unexpectedFailedRequests }, null, 2));
  console.log("VISUAL RECOVERY BROWSER QA: PASS");
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
    killer.once("exit", resolve);
    killer.once("error", resolve);
  });
  await pause(400);
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
