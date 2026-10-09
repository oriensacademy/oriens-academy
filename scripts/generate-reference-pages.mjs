#!/usr/bin/env node
/**
 * Generates the scoped CSS, static markup fragments and image assets for the
 * three customer reference pages (/tr/giris/, /tr/ucretler/, /tr/hakkimizda/)
 * directly from the customer's HTML files, so production stays a literal port.
 *
 * Usage:
 *   node scripts/generate-reference-pages.mjs [loginHtml] [pricingHtml] [aboutHtml]
 *
 * Outputs:
 *   public/reference/oa-<hash>.png                         data-URI images
 *   src/components/reference/generated/reference-<page>.css scoped styles
 *   src/components/reference/generated/markup.ts            static fragments
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DOWNLOADS = "C:/Users/merto/Downloads";
const [loginArg, pricingArg, aboutArg] = process.argv.slice(2);
const SOURCES = {
  login: loginArg || `${DOWNLOADS}/oriens-giris-iyilestirilmis_14 (2).html`,
  pricing: pricingArg || `${DOWNLOADS}/oriens-ucretler_17 (2).html`,
  about: aboutArg || `${DOWNLOADS}/oriens-hakkimizda-iyilestirilmis_21 (1).html`,
};
const WRAPPER = {
  login: "reference-login-page",
  pricing: "reference-pricing-page",
  about: "reference-about-page",
};
const CURRENT_ROUTE = { login: "/tr/giris/", pricing: "/tr/ucretler/", about: "/tr/hakkimizda/" };
const EN_ROUTE = { login: "/en/login/", pricing: "/en/pricing/", about: "/en/about/" };

const PUBLIC_DIR = path.join(ROOT, "public", "reference");
const OUT_DIR = path.join(ROOT, "src", "components", "reference", "generated");

/* ------------------------------------------------------------------ images */
const images = new Map();
async function extractImages(html) {
  const pattern = /src="data:image\/(png|jpeg|webp|svg\+xml);base64,([^"]+)"/g;
  const replacements = [];
  for (const match of html.matchAll(pattern)) {
    const [whole, type, data] = match;
    const buffer = Buffer.from(data, "base64");
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
    const extension = type === "jpeg" ? "jpg" : type === "svg+xml" ? "svg" : type;
    const file = `oa-${hash}.${extension}`;
    if (!images.has(file)) images.set(file, buffer);
    replacements.push([whole, `src="/reference/${file}"`]);
  }
  for (const [from, to] of replacements) html = html.replace(from, to);
  return html;
}

/* -------------------------------------------------------------------- links */
const HTML_ROUTES = [
  [/^oriens-ana-sayfa[^"]*\.html$/, "/tr/"],
  [/^oriens-sinavlar[^"]*\.html$/, "/tr/sinavlar/"],
  [/^oriens-universite-destegi[^"]*\.html$/, "/tr/universite-destegi/"],
  [/^oriens-ucretler[^"]*\.html$/, "/tr/ucretler/"],
  [/^oriens-blog[^"]*\.html$/, "/tr/blog/"],
  [/^oriens-hakkimizda[^"]*\.html$/, "/tr/hakkimizda/"],
  [/^oriens-giris[^"]*\.html$/, "/tr/giris/"],
  [/^oriens-kayit[^"]*\.html$/, "/tr/giris/?mode=register"],
  [/^oriens-gorusme[^"]*\.html$/, "/tr/randevu/"],
];

function mapLinks(html, page) {
  return html.replace(/href="([^"]*)"/g, (whole, href) => {
    if (href === "#") return `href="${CURRENT_ROUTE[page]}"`;
    if (href === "https://oriens-academy.com/en/" || href === "https://oriens-academy.com/en/login/") {
      return `href="${EN_ROUTE[page]}"`;
    }
    if (href.startsWith("https://oriens-academy.com/")) return `href="${href.slice("https://oriens-academy.com".length)}"`;
    if (href.endsWith(".html")) {
      const route = HTML_ROUTES.find(([pattern]) => pattern.test(href));
      if (!route) throw new Error(`Unmapped reference link in ${page}: ${href}`);
      return `href="${route[1]}"`;
    }
    return whole;
  });
}

/* ------------------------------------------------------------------ contact */
function contactPlaceholders(html) {
  return html
    .replaceAll('href="https://wa.me/905442939040"', 'href="{{WA_HREF}}"')
    .replaceAll('href="tel:+908503040467"', 'href="{{TEL_HREF}}"')
    .replaceAll('href="mailto:info@oriens-academy.com"', 'href="{{MAIL_HREF}}"')
    .replaceAll('href="https://instagram.com/oriens.academy"', 'href="{{IG_HREF}}"')
    .replaceAll("+90 544 293 90 40", "{{WA_INTL}}")
    .replaceAll("0544 293 90 40", "{{WA_LOCAL}}")
    .replaceAll("0850 304 04 67", "{{TEL_DISPLAY}}")
    .replaceAll("info@oriens-academy.com", "{{MAIL}}");
}

/* ---------------------------------------------------------------------- css */
const ROOT_SELECTOR = /^((?:html|body|:root)(?:\s+(?:html|body|:root))*)(?=$|[\s>+~.:#[])/;

function scopeSelector(selector, scope) {
  const trimmed = selector.trim();
  const rootMatch = trimmed.match(ROOT_SELECTOR);
  if (rootMatch) return `${scope}${trimmed.slice(rootMatch[0].length)}`;
  return `${scope} ${trimmed}`;
}

function scopeCss(css, page) {
  const wrapper = `.${WRAPPER[page]}`;
  // The :not(#_) suffix lifts every reference rule above the site's unlayered
  // class-based rules (e.g. the mobile 16px input rule in globals.css) while
  // keeping the reference's own relative specificity untouched.
  const scope = `${wrapper}:not(#_)`;
  const root = postcss.parse(css);
  const keyframes = new Map();
  root.walkAtRules(/^(-webkit-)?keyframes$/, (rule) => {
    const renamed = `${WRAPPER[page]}-${rule.params}`;
    keyframes.set(rule.params, renamed);
    rule.params = renamed;
  });
  root.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
    rule.selectors = rule.selectors.map((selector) => scopeSelector(selector, scope));
  });
  root.walkDecls(/^(-webkit-)?animation(-name)?$/, (decl) => {
    decl.value = decl.value
      .split(",")
      .map((part) => part.replace(/[A-Za-z_][\w-]*/g, (token) => keyframes.get(token) ?? token))
      .join(",");
  });
  return root.toString();
}

function resetCss(page) {
  const w = `.${WRAPPER[page]}`;
  return `/* Generated by scripts/generate-reference-pages.mjs — do not edit by hand. */
/* Source: ${path.basename(SOURCES[page])} */

/* 1) Neutralise the site's Tailwind preflight/base layer inside the wrapper so
      the reference renders against plain user-agent defaults, exactly like the
      standalone HTML file. Specificity 0 → every reference rule below wins. */
:where(${w}, ${w} *:not(svg, svg *)),
:where(${w}, ${w} *)::before,
:where(${w}, ${w} *)::after,
:where(${w} *)::placeholder,
:where(${w} *)::marker { all: revert; }
:where(${w} svg) { display: revert; vertical-align: revert; box-sizing: revert; margin: revert; padding: revert; border: revert; outline: revert; }

/* 2) The wrapper stands in for <html>/<body>: restore the inherited values a
      standalone document starts from, before the reference's own body rules. */
${w} {
  display: block; margin: 0; padding: 0;
  font-family: "Times New Roman", serif; font-size: 16px; line-height: normal; font-weight: 400;
  font-style: normal; letter-spacing: normal; word-spacing: normal; text-transform: none;
  text-align: start; text-indent: 0; white-space: normal; color: #000;
  font-feature-settings: normal; font-variation-settings: normal; font-optical-sizing: auto;
  font-kerning: auto; -webkit-font-smoothing: auto; -moz-osx-font-smoothing: auto;
  text-rendering: auto; color-scheme: normal; -webkit-text-size-adjust: auto; text-size-adjust: auto;
  tab-size: 8; cursor: auto; overflow-wrap: normal; word-break: normal; hyphens: manual;
}
body:has(> * ${w}), body:has(${w}) { background: #F6F8F3; }
`;
}

function extractStyles(html) {
  const styles = [];
  const markup = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (_, css) => {
    styles.push(css);
    return "";
  });
  return { css: styles.join("\n"), markup };
}

/* -------------------------------------------------------------------- html */
function between(html, start, end, { includeStart = true, includeEnd = true } = {}) {
  const from = html.indexOf(start);
  if (from < 0) throw new Error(`Marker not found: ${start}`);
  const to = html.indexOf(end, from + start.length);
  if (to < 0) throw new Error(`Marker not found: ${end}`);
  return html.slice(includeStart ? from : from + start.length, includeEnd ? to + end.length : to);
}

function clean(fragment) {
  return fragment.replace(/<!--[\s\S]*?-->/g, "").replace(/^\s+|\s+$/g, "");
}

async function processPage(page) {
  let html = await readFile(SOURCES[page], "utf8");
  html = await extractImages(html);
  html = mapLinks(html, page);
  const { css, markup } = extractStyles(html);
  const body = between(markup, "<body>", "</body>", { includeStart: false, includeEnd: false });
  const fragments = {};
  fragments.header = clean(between(body, page === "login" ? "<header>" : '<header class="oh"', "</header>"));
  fragments.footer = contactPlaceholders(clean(between(body, '<footer class="of">', "</footer>")));
  if (page === "pricing") {
    const main = between(body, "</header>", "<!--OF-START-->", { includeStart: false, includeEnd: false });
    const packagesStart = main.indexOf('<section class="pk-wrap"');
    const packagesEnd = main.indexOf("</section>", packagesStart) + "</section>".length;
    fragments.hero = clean(main.slice(0, packagesStart));
    fragments.packages = clean(main.slice(packagesStart, packagesEnd));
    fragments.after = contactPlaceholders(clean(main.slice(packagesEnd)));
  }
  if (page === "about") {
    fragments.main = contactPlaceholders(
      clean(between(body, "</header>", "<!--OF-START-->", { includeStart: false, includeEnd: false })),
    );
  }
  if (page === "login") {
    fragments.main = clean(between(body, '<main id="giris">', "</main>"));
  }
  const scoped = `${resetCss(page)}\n${scopeCss(css, page)}\n`;
  return { css: scoped, fragments };
}

const result = {};
for (const page of Object.keys(SOURCES)) result[page] = await processPage(page);

await mkdir(PUBLIC_DIR, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });
for (const [file, buffer] of images) await writeFile(path.join(PUBLIC_DIR, file), buffer);
for (const page of Object.keys(result)) {
  await writeFile(path.join(OUT_DIR, `reference-${page}.css`), `${result[page].css.trimEnd()}\n`);
}

const exportName = (page, key) => `${page.toUpperCase()}_${key.toUpperCase()}_HTML`;
let ts = "/* Generated by scripts/generate-reference-pages.mjs — do not edit by hand. */\n";
ts += "\n";
for (const [page, { fragments }] of Object.entries(result)) {
  for (const [key, value] of Object.entries(fragments)) {
    if (page === "login" && key === "main") continue; // login main is rendered in React
    if (page === "pricing" && key === "packages") continue; // rows come from canonical pricing data
    ts += `export const ${exportName(page, key)} = ${JSON.stringify(value)};\n\n`;
  }
}
await writeFile(path.join(OUT_DIR, "markup.ts"), `${ts.trimEnd()}\n`);

// Reference-only fragments kept for literal JSX ports and parity checks.
await writeFile(
  path.join(OUT_DIR, "reference-fragments.json"),
  `${JSON.stringify({ loginMain: result.login.fragments.main, pricingPackages: result.pricing.fragments.packages }, null, 2)}\n`,
);

console.log("images:", [...images.keys()].join(", "));
for (const page of Object.keys(result)) {
  console.log(page, Object.keys(result[page].fragments).map((key) => `${key}=${result[page].fragments[key].length}`).join(" "));
}
