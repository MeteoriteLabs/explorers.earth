import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.env.LANDING_QA_URL ?? "http://127.0.0.1:5173/";
const resourcesDir = path.resolve("src/i18n/resources");
const rtlLanguages = new Set(["ar", "fa", "he", "ur"]);
const representativeMobileCodes = new Set(["ar", "de", "ja", "ta", "th", "ur", "zh"]);
const openGraphLocales = {
  ar: "ar_SA",
  as: "as_IN",
  bg: "bg_BG",
  bn: "bn_IN",
  cs: "cs_CZ",
  de: "de_DE",
  el: "el_GR",
  en: "en_US",
  es: "es_ES",
  fa: "fa_IR",
  fi: "fi_FI",
  fr: "fr_FR",
  gu: "gu_IN",
  ha: "ha_NG",
  he: "he_IL",
  hi: "hi_IN",
  hr: "hr_HR",
  hu: "hu_HU",
  id: "id_ID",
  it: "it_IT",
  ja: "ja_JP",
  kn: "kn_IN",
  ko: "ko_KR",
  ml: "ml_IN",
  mr: "mr_IN",
  ms: "ms_MY",
  my: "my_MM",
  ne: "ne_NP",
  nl: "nl_NL",
  or: "or_IN",
  pa: "pa_IN",
  pl: "pl_PL",
  pt: "pt_PT",
  ro: "ro_RO",
  ru: "ru_RU",
  sr: "sr_RS",
  sv: "sv_SE",
  sw: "sw_TZ",
  ta: "ta_IN",
  te: "te_IN",
  th: "th_TH",
  tl: "tl_PH",
  tr: "tr_TR",
  uk: "uk_UA",
  ur: "ur_IN",
  vi: "vi_VN",
  zh: "zh_CN",
};
const intentionalFallbackPaths = new Set([
  "hero.countries.in",
  "hero.countries.au",
  "hero.countries.fr",
  "sections.whoIsFor.explorerLabel",
  "sections.whoIsFor.visual.creators",
  "sections.whoIsFor.visual.hostsQr",
]);

function parseResource(code) {
  return JSON.parse(
    fs
      .readFileSync(path.join(resourcesDir, `${code}.json`), "utf8")
      .replace(/^\uFEFF/, ""),
  );
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, part) => value?.[part], object);
}

function assertNoMalformedCharacters(text, label) {
  if (text.includes("\uFFFD")) {
    throw new Error(`${label} contains replacement character`);
  }
}

function assertNotEqual(actual, disallowed, label) {
  if (actual.trim() === disallowed.trim()) {
    throw new Error(`${label} still equals English fallback "${disallowed}"`);
  }
}

async function sectionText(page, selector) {
  const element = page.locator(selector).first();
  await element.waitFor({ state: "visible", timeout: 15000 });
  return (await element.innerText()).replace(/\s+/g, " ").trim();
}

async function waitForSectionText(page, selector, expectedText, code, label) {
  await page.waitForFunction(
    ({ selector: targetSelector, expected }) => {
      const element = document.querySelector(targetSelector);
      return element?.textContent?.replace(/\s+/g, " ").trim() === expected;
    },
    { selector, expected: expectedText },
    { timeout: 15000 },
  ).catch(() => {
    throw new Error(`${code} ${label}: timed out waiting for resource text "${expectedText}"`);
  });
}

async function verifyLanguage(page, code, english, resource) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#hero").waitFor({ state: "visible", timeout: 15000 });
  await page.evaluate((language) => {
    localStorage.setItem("explorers-language", language);
  }, code);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#hero").waitFor({ state: "visible", timeout: 15000 });
  const expectedProduct = getPath(resource, "sections.productCategories.headline");
  const expectedShare = getPath(resource, "sections.shareAnywhere.headline");
  const expectedWho = getPath(resource, "sections.whoIsFor.headline");
  await waitForSectionText(page, "#product h2", expectedProduct, code, "product");
  await page.waitForFunction(
    ({ product, share }) => {
      const navText = Array.from(document.querySelectorAll("header nav button"))
        .map((button) => button.textContent?.replace(/\s+/g, " ").trim() ?? "")
        .join(" ");
      return navText.includes(product) && navText.includes(share);
    },
    {
      product: getPath(resource, "header.nav.product"),
      share: getPath(resource, "header.nav.share"),
    },
    { timeout: 15000 },
  );
  await page.waitForFunction(
    ({ expectedTitle }) => document.title === expectedTitle,
    { expectedTitle: getPath(resource, "seo.landing.title") },
    { timeout: 15000 },
  );

  const documentMeta = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
  const expectedDir = rtlLanguages.has(code) ? "rtl" : "ltr";
  if (documentMeta.lang !== code) {
    throw new Error(`${code}: expected document lang ${code}, got ${documentMeta.lang}`);
  }
  if (documentMeta.dir !== expectedDir) {
    throw new Error(`${code}: expected document dir ${expectedDir}, got ${documentMeta.dir}`);
  }

  const hero = await sectionText(page, "#hero h1");
  const product = await sectionText(page, "#product h2");
  const share = await sectionText(page, "#share h2");
  const who = await sectionText(page, "#who-is-for h2");
  const metadata = await page.evaluate(() => ({
    title: document.title,
    description:
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute("content") ?? "",
    contentLanguage:
      document
        .querySelector('meta[http-equiv="content-language"]')
        ?.getAttribute("content") ?? "",
    ogLocale:
      document
        .querySelector('meta[property="og:locale"]')
        ?.getAttribute("content") ?? "",
  }));

  assertNoMalformedCharacters(`${hero} ${product} ${share} ${who}`, code);
  assertNotEqual(product, getPath(english, "sections.productCategories.headline"), `${code} product`);
  assertNotEqual(share, getPath(english, "sections.shareAnywhere.headline"), `${code} share`);
  assertNotEqual(who, getPath(english, "sections.whoIsFor.headline"), `${code} who`);

  for (const [label, text, expected] of [
    ["product", product, expectedProduct],
    ["share", share, expectedShare],
    ["who", who, expectedWho],
    ["seo title", metadata.title, getPath(resource, "seo.landing.title")],
    [
      "seo description",
      metadata.description,
      getPath(resource, "seo.landing.description"),
    ],
    ["og locale", metadata.ogLocale, openGraphLocales[code] ?? code],
  ]) {
    if (text !== expected) {
      throw new Error(`${code} ${label}: expected resource text "${expected}", got "${text}"`);
    }
  }

  for (const dottedPath of [
    "sections.productCategories.headline",
    "sections.shareAnywhere.headline",
    "sections.whoIsFor.headline",
  ]) {
    if (
      !intentionalFallbackPaths.has(dottedPath) &&
      JSON.stringify(getPath(resource, dottedPath)) === JSON.stringify(getPath(english, dottedPath))
    ) {
      throw new Error(`${code}: ${dottedPath} still equals English resource fallback`);
    }
  }
}

async function verifyMobile(page, code) {
  if (!representativeMobileCodes.has(code)) return;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#hero").waitFor({ state: "visible", timeout: 15000 });
  await page.evaluate((language) => {
    localStorage.setItem("explorers-language", language);
  }, code);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#hero").waitFor({ state: "visible", timeout: 15000 });
  await waitForSectionText(
    page,
    "#product h2",
    getPath(parseResource(code), "sections.productCategories.headline"),
    code,
    "mobile product",
  );

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  if (hasHorizontalOverflow) {
    throw new Error(`${code}: horizontal overflow on mobile`);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

const languageCodes = fs
  .readdirSync(resourcesDir)
  .filter((file) => file.endsWith(".json") && file !== "en.json")
  .map((file) => file.replace(".json", ""))
  .sort();

const english = parseResource("en");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  for (const code of languageCodes) {
    console.log(`Checking ${code}...`);
    const resource = parseResource(code);
    await verifyLanguage(page, code, english, resource);
    await verifyMobile(page, code);
  }

  console.log(`Landing language switch QA OK for ${languageCodes.length} languages at ${baseUrl}`);
} finally {
  await browser.close();
}
