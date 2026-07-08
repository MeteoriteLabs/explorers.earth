import fs from "node:fs";
import path from "node:path";

const resourcesDir = path.resolve("src/i18n/resources");
const cachePath = path.resolve("scripts/.landing-translation-cache.json");

const batches = {
  A: ["de", "it", "nl", "pt", "sv", "fi", "pl", "cs", "hr", "hu", "ro", "tr"],
  B: ["zh", "ja", "ko", "id", "ms", "vi", "tl", "th", "my"],
  C: ["ar", "fa", "he", "ur", "ru", "uk", "bg", "sr", "el"],
  D: ["bn", "te", "mr", "ta", "gu", "kn", "or", "ml", "pa", "as", "ne"],
  E: ["ha", "sw"],
};

const googleLanguageCodes = {
  zh: "zh-CN",
};

const preserveWords = [
  "explorers.earth",
  "Explorer",
  "QR",
  "Airbnb",
  "Airbnbs",
  "TikTok",
  "Instagram",
];

const preservePathSuffixes = new Set([
  "id",
]);

const manualTranslations = {
  my: {
    "Open navigation menu": "လမ်းညွှန်မီနူးကို ဖွင့်ပါ",
    "Close navigation menu": "လမ်းညွှန်မီနူးကို ပိတ်ပါ",
  },
  nl: {
    Product: "Producten",
  },
};

const args = process.argv.slice(2);
const requestedBatch = args.find((arg) => arg.startsWith("--batch="))?.split("=")[1];
const requestedLanguages = args
  .find((arg) => arg.startsWith("--languages="))
  ?.split("=")[1]
  ?.split(",")
  .map((code) => code.trim())
  .filter(Boolean);

const targetLanguages =
  requestedLanguages ??
  (requestedBatch ? batches[requestedBatch] : Object.values(batches).flat());
const maxConcurrentRequests = Number(process.env.TRANSLATE_CONCURRENCY ?? "4");
let activeRequests = 0;
const requestQueue = [];

if (!targetLanguages?.length) {
  console.error("No target languages selected. Use --batch=A or --languages=de,it.");
  process.exit(1);
}

function parseResource(code) {
  return JSON.parse(
    fs
      .readFileSync(path.join(resourcesDir, `${code}.json`), "utf8")
      .replace(/^\uFEFF/, ""),
  );
}

function writeResource(code, data) {
  fs.writeFileSync(
    path.join(resourcesDir, `${code}.json`),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

function loadCache() {
  if (!fs.existsSync(cachePath)) return {};
  return JSON.parse(fs.readFileSync(cachePath, "utf8"));
}

function saveCache(cache) {
  fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function withRequestLimit(task) {
  if (activeRequests >= maxConcurrentRequests) {
    await new Promise((resolve) => requestQueue.push(resolve));
  }

  activeRequests += 1;
  try {
    return await task();
  } finally {
    activeRequests -= 1;
    requestQueue.shift()?.();
  }
}

function protectText(text) {
  const replacements = [];
  let protectedText = text.replace(/\{\{[^}]+\}\}/g, (match) => {
    const token = `I18NTOKEN${replacements.length}`;
    replacements.push([token, match]);
    return token;
  });

  for (const word of preserveWords) {
    protectedText = protectedText.replaceAll(word, () => {
      const token = `I18NTOKEN${replacements.length}`;
      replacements.push([token, word]);
      return token;
    });
  }

  return { protectedText, replacements };
}

function restoreText(text, replacements) {
  let restored = text;
  for (const [token, original] of replacements) {
    restored = restored.replaceAll(token, original);
    restored = restored.replaceAll(token.toLowerCase(), original);
    restored = restored.replaceAll(token.toUpperCase(), original);
    restored = restored.replaceAll(token.replace("TOKEN", " TOKEN "), original);
  }
  return restored;
}

async function translateString(text, targetLanguage, cache) {
  if (!text.trim()) return text;
  const manualTranslation = manualTranslations[targetLanguage]?.[text];
  if (manualTranslation) return manualTranslation;

  const cacheKey = `${targetLanguage}\u0000${text}`;
  if (cache[cacheKey]) return cache[cacheKey];

  const { protectedText, replacements } = protectText(text);
  const params = new URLSearchParams({
    client: "gtx",
    sl: "en",
    tl: googleLanguageCodes[targetLanguage] ?? targetLanguage,
    dt: "t",
    q: protectedText,
  });

  const payload = await withRequestLimit(async () => {
    let response;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      response = await fetch(
        `https://translate.googleapis.com/translate_a/single?${params}`,
      );
      if (response.ok) return response.json();
      if (attempt === 5) {
        throw new Error(
          `Translate request failed for ${targetLanguage}: ${response.status} ${response.statusText} while translating "${text}"`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  });
  const translated = restoreText(
    payload?.[0]?.map((part) => part?.[0] ?? "").join("") ?? text,
    replacements,
  );

  cache[cacheKey] = translated;
  saveCache(cache);
  return translated;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function translateValue(value, targetLanguage, cache, pathParts = []) {
  if (typeof value === "string") {
    const pathSuffix = pathParts[pathParts.length - 1];
    if (preservePathSuffixes.has(pathSuffix)) return value;
    return translateString(value, targetLanguage, cache);
  }

  if (Array.isArray(value)) {
    return Promise.all(
      value.map((item, index) =>
        translateValue(item, targetLanguage, cache, [
          ...pathParts,
          String(index),
        ]),
      ),
    );
  }

  if (value && typeof value === "object") {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, child]) => [
        key,
        await translateValue(child, targetLanguage, cache, [...pathParts, key]),
      ]),
    );
    return Object.fromEntries(entries);
  }

  return value;
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] =
        target[key] && typeof target[key] === "object" && !Array.isArray(target[key])
          ? target[key]
          : {};
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

function landingSourceFromEnglish(english) {
  return {
    header: {
      nav: {
        product: english.header.nav.product,
        howItWorks: english.header.nav.howItWorks,
        share: english.header.nav.share,
        faq: english.header.nav.faq,
        openMenu: english.header.nav.openMenu,
        closeMenu: english.header.nav.closeMenu,
      },
      auth: {
        claimFreePage: english.header.auth.claimFreePage,
        claimFree: english.header.auth.claimFree,
      },
    },
    hero: clone(english.hero),
    sections: {
      productCategories: clone(english.sections.productCategories),
      createCustomize: clone(english.sections.createCustomize),
      shareAnywhere: clone(english.sections.shareAnywhere),
      analytics: {
        headline: english.sections.analytics.headline,
        subtext: english.sections.analytics.subtext,
        workingTitle: english.sections.analytics.workingTitle,
        workingDesc: english.sections.analytics.workingDesc,
        scanningTitle: english.sections.analytics.scanningTitle,
        scanningDesc: english.sections.analytics.scanningDesc,
        spotsTitle: english.sections.analytics.spotsTitle,
        spotsDesc: english.sections.analytics.spotsDesc,
        dashboardTitle: english.sections.analytics.dashboardTitle,
        last30Days: english.sections.analytics.last30Days,
        totalScans: english.sections.analytics.totalScans,
        engagement: english.sections.analytics.engagement,
        referrals: english.sections.analytics.referrals,
        livePreview: english.sections.analytics.livePreview,
      },
      testimonials: {
        headline: english.sections.testimonials.headline,
        subtext: english.sections.testimonials.subtext,
        items: clone(english.sections.testimonials.items),
      },
      whoIsFor: clone(english.sections.whoIsFor),
      faq: {
        fallbackItems: clone(english.sections.faq.fallbackItems),
      },
    },
    seo: {
      landing: clone(english.seo.landing),
    },
    usernameClaim: clone(english.usernameClaim),
    languageModal: clone(english.languageModal),
    footer: {
      tagline: english.footer.tagline,
      links: {
        howItWorks: english.footer.links.howItWorks,
        faq: english.footer.links.faq,
        contact: english.footer.links.contact,
        about: english.footer.links.about,
        terms: english.footer.links.terms,
        privacy: english.footer.links.privacy,
        cookies: english.footer.links.cookies,
        product: english.footer.links.product,
        shareAnywhere: english.footer.links.shareAnywhere,
      },
      freeForever: english.footer.freeForever,
      copyright: english.footer.copyright,
      madeWithLove: english.footer.madeWithLove,
      sections: {
        product: english.footer.sections.product,
        company: english.footer.sections.company,
        legal: english.footer.sections.legal,
      },
    },
  };
}

const english = parseResource("en");
const source = landingSourceFromEnglish(english);
const cache = loadCache();

for (const language of targetLanguages) {
  console.log(`Translating landing copy for ${language}...`);
  const data = parseResource(language);
  const translatedLanding = await translateValue(source, language, cache);
  merge(data, translatedLanding);
  writeResource(language, data);
  saveCache(cache);
}

console.log(`Translated landing copy for ${targetLanguages.length} languages.`);
