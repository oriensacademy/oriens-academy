import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const baseUrl = (process.env.SEARCH_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profilePath = await mkdtemp(path.join(tmpdir(), "oriens-search-qa-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profilePath}`,
  "--no-first-run",
  "--disable-gpu",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let commandId = 0;
const pending = new Map();
const eventWaiters = new Map();
let interceptionMode = "pass";
let devtoolsHttpBase = "";

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

function waitForEvent(method, timeout = 20_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), timeout);
    const wrapped = (value) => { clearTimeout(timer); resolve(value); };
    eventWaiters.set(method, [...(eventWaiters.get(method) || []), wrapped]);
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitUntil(expression, timeout = 10_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function navigate(route, width = 1280, height = 900) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  const loaded = waitForEvent("Page.loadEventFired");
  await send("Page.navigate", { url: `${baseUrl}${route}` });
  await loaded;
  await waitUntil("!!document.querySelector('[role=combobox]')", 20_000);
  // Wait for React hydration before driving the controlled input.
  await pause(1_200);
}

async function setInput(value) {
  await evaluate(`(() => {
    const input = document.querySelector('[role=combobox]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  })()`);
}

function responseBody(query, title) {
  return Buffer.from(JSON.stringify({
    query,
    intent: "UNIVERSITY_SEARCH",
    confidence: 1,
    groups: {
      universities: [{ id: query.padEnd(36, "0").slice(0, 36), type: "UNIVERSITY", title, slug: query, score: 100 }],
      programs: [], countries: [], qualifications: [],
    },
    totalCount: 1,
  })).toString("base64");
}

async function handlePaused(params) {
  const url = new URL(params.request.url);
  if (!url.pathname.includes("/api/search/autocomplete")) {
    await send("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
    return;
  }
  if (interceptionMode === "error") {
    await send("Fetch.fulfillRequest", {
      requestId: params.requestId,
      responseCode: 503,
      responseHeaders: [{ name: "content-type", value: "application/json" }],
      body: Buffer.from('{"error":"SEARCH_BACKEND_UNAVAILABLE"}').toString("base64"),
    }).catch(() => {});
    return;
  }
  if (interceptionMode === "race") {
    const query = url.searchParams.get("q") || "";
    const delays = { ox: 900, oxf: 650, oxfo: 400, oxfor: 50 };
    await pause(delays[query] || 0);
    await send("Fetch.fulfillRequest", {
      requestId: params.requestId,
      responseCode: 200,
      responseHeaders: [{ name: "content-type", value: "application/json" }],
      body: responseBody(query, query === "oxfor" ? "LATEST OXFOR" : `STALE ${query.toUpperCase()}`),
    }).catch(() => {});
    return;
  }
  await send("Fetch.continueRequest", { requestId: params.requestId }).catch(() => {});
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
      const promise = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) promise.reject(new Error(message.error.message));
      else promise.resolve(message.result);
      return;
    }
    for (const resolve of eventWaiters.get(message.method) || []) resolve(message.params);
    eventWaiters.delete(message.method);
    if (message.method === "Fetch.requestPaused") void handlePaused(message.params);
  });
  await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Network.enable")]);

  for (const locale of ["tr", "en"]) {
    await navigate(`/${locale}/`);
    await setInput("oxford");
    await waitUntil("document.body.innerText.includes('University of Oxford')", 15_000);
    assert.equal(await evaluate("document.body.innerText.includes('Oxford, United Kingdom')"), true, `${locale}: Oxford subtitle missing`);
  }

  await setInput("zzzz-no-real-entity-98371");
  await waitUntil("document.body.innerText.includes('No matching results found.')");

  await send("Fetch.enable", { patterns: [{ urlPattern: "*api/search/autocomplete*", requestStage: "Request" }] });
  interceptionMode = "error";
  await setInput("");
  await pause(350);
  await setInput("backend-error");
  await waitUntil("document.body.innerText.includes('Search is temporarily unavailable.')");
  assert.equal(await evaluate("document.body.innerText.includes('No matching results found.')"), false, "backend failure rendered as zero results");

  interceptionMode = "race";
  for (const query of ["ox", "oxf", "oxfo", "oxfor"]) {
    await setInput(query);
    await pause(300);
  }
  await waitUntil("document.body.innerText.includes('LATEST OXFOR')", 10_000);
  await pause(1_000);
  assert.equal(await evaluate("document.body.innerText.includes('STALE OX') || document.body.innerText.includes('STALE OXF')"), false, "stale response overwrote latest query");

  await send("Fetch.disable");
  interceptionMode = "pass";
  const viewports = [360, 390, 430, 768, 1280];
  for (const width of viewports) {
    await navigate("/tr/", width, 900);
    await setInput("Massachusetts Institute of Technology");
    await waitUntil("document.body.innerText.includes('Massachusetts Institute of Technology')", 15_000);
    const layout = await evaluate(`(() => {
      const dropdown = document.querySelector('#academic-search-results');
      const input = document.querySelector('[role=combobox]');
      const option = dropdown?.querySelector('[role=option]');
      const rect = dropdown?.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth > innerWidth,
        dropdownInsideViewport: !!rect && rect.left >= 0 && rect.right <= innerWidth + 1,
        hasOption: !!option,
        inputFocused: document.activeElement === input,
        scrollable: !!dropdown && dropdown.scrollHeight >= dropdown.clientHeight,
      };
    })()`);
    assert.equal(layout.documentOverflow, false, `${width}px: horizontal overflow`);
    assert.equal(layout.dropdownInsideViewport, true, `${width}px: dropdown outside viewport`);
    assert.equal(layout.hasOption, true, `${width}px: result missing`);
    assert.equal(layout.inputFocused, true, `${width}px: input lost focus`);
  }

  await setInput("oxford");
  await waitUntil("document.body.innerText.includes('University of Oxford')");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", code: "ArrowDown" });
  assert.equal(await evaluate("!!document.querySelector('[role=option][aria-selected=true]')"), true, "keyboard selection missing");

  await setInput("");
  await pause(800);
  assert.equal(await evaluate("!!document.querySelector('#academic-search-results')"), false, "empty query opened a zero-result dropdown");

  console.log(JSON.stringify({ locales: ["tr", "en"], race: "PASS", errorState: "PASS", zeroResult: "PASS", viewports, keyboard: "PASS", emptyQuery: "PASS" }, null, 2));
  console.log("SEARCH BROWSER QA: PASS");
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await new Promise((resolve) => {
    const killer = spawn("taskkill", ["/pid", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
    killer.once("exit", resolve);
    killer.once("error", resolve);
  });
  await pause(500);
  await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
