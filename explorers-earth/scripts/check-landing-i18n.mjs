import fs from "node:fs";
import path from "node:path";

const resourcesDir = path.resolve("src/i18n/resources");
const languageFiles = fs
  .readdirSync(resourcesDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

const requiredPaths = [
  "hero.headlinePrefix",
  "hero.rotatingWords",
  "hero.headlineSuffix",
  "hero.subtext",
  "hero.badge",
  "hero.globalStrip",
  "hero.preview.todayList",
  "hero.preview.onePageTitle",
  "hero.preview.onePageText",
  "hero.preview.items.place",
  "hero.preview.items.book",
  "hero.preview.items.music",
  "hero.preview.items.game",
  "hero.preview.screenAlt",
  "hero.countries.in",
  "hero.countries.us",
  "hero.countries.gb",
  "hero.countries.jp",
  "hero.countries.fr",
  "hero.countries.au",
  "hero.countries.br",
  "hero.countries.ae",
  "hero.countries.sg",
  "hero.countries.de",
  "sections.productCategories.headline",
  "sections.productCategories.subtext",
  "sections.productCategories.actions",
  "sections.productCategories.overlayLabel",
  "sections.productCategories.visualLabels.products",
  "sections.productCategories.visualLabels.apps",
  "sections.productCategories.visualDetails.products",
  "sections.productCategories.visualDetails.apps",
  "sections.productCategories.categories",
  "sections.createCustomize.headline",
  "sections.createCustomize.subtext",
  "sections.createCustomize.steps",
  "sections.shareAnywhere.headline",
  "sections.shareAnywhere.cards",
  "sections.shareAnywhere.visual.scanForPicks",
  "sections.shareAnywhere.visual.messageBubble",
  "sections.shareAnywhere.visual.welcomeGuide",
  "sections.shareAnywhere.visual.guideItems",
  "sections.shareAnywhere.visual.savedRecommendation",
  "sections.whoIsFor.headline",
  "sections.whoIsFor.subtext",
  "sections.whoIsFor.explorerLabel",
  "sections.whoIsFor.cards",
  "sections.whoIsFor.visual.personal",
  "sections.whoIsFor.visual.creators",
  "sections.whoIsFor.visual.hostsQr",
  "sections.whoIsFor.chips",
  "sections.analytics.livePreview",
  "sections.analytics.headline",
  "sections.analytics.subtext",
  "sections.analytics.workingTitle",
  "sections.analytics.workingDesc",
  "sections.analytics.scanningTitle",
  "sections.analytics.scanningDesc",
  "sections.analytics.spotsTitle",
  "sections.analytics.spotsDesc",
  "sections.analytics.dashboardTitle",
  "sections.analytics.last30Days",
  "sections.analytics.totalScans",
  "sections.analytics.engagement",
  "sections.analytics.referrals",
  "sections.testimonials.headline",
  "sections.testimonials.subtext",
  "sections.testimonials.items",
  "header.nav.product",
  "header.nav.share",
  "header.nav.howItWorks",
  "header.nav.faq",
  "header.nav.openMenu",
  "header.nav.closeMenu",
  "header.auth.claimFreePage",
  "header.auth.claimFree",
  "seo.landing.title",
  "seo.landing.description",
  "seo.landing.keywords",
  "seo.landing.geoDescription",
  "seo.landing.geoFeatures",
  "seo.landing.geoIndustry",
  "sections.faq.fallbackItems",
  "usernameClaim.validating",
  "usernameClaim.claimFree",
  "usernameClaim.trySuggestions",
  "usernameClaim.available",
  "usernameClaim.unavailable",
  "usernameClaim.confirmOnSignup",
  "usernameClaim.checkingAvailability",
  "languageModal.title",
  "languageModal.subtitle",
  "languageModal.searchPlaceholder",
  "languageModal.noLanguagesFound",
  "languageModal.tryDifferentSearch",
  "languageModal.languagesAvailable",
  "languageModal.escToClose",
  "languageModal.close",
  "footer.links.product",
  "footer.links.shareAnywhere",
  "footer.links.howItWorks",
  "footer.links.faq",
  "footer.links.contact",
  "footer.links.about",
  "footer.links.terms",
  "footer.links.privacy",
  "footer.links.cookies",
  "footer.tagline",
  "footer.freeForever",
  "footer.sections.company",
  "footer.sections.product",
  "footer.sections.legal",
  "footer.copyright",
  "footer.madeWithLove",
];

const exactLengthPaths = new Map([
  ["hero.rotatingWords", 4],
  ["sections.productCategories.actions", 3],
  ["sections.productCategories.visualDetails.products", 3],
  ["sections.productCategories.visualDetails.apps", 3],
  ["sections.productCategories.categories", 8],
  ["sections.createCustomize.steps", 3],
  ["sections.shareAnywhere.cards", 4],
  ["sections.shareAnywhere.visual.guideItems", 3],
  ["sections.whoIsFor.cards", 4],
  ["sections.whoIsFor.visual.personal", 6],
  ["sections.whoIsFor.visual.creators", 4],
  ["sections.whoIsFor.chips", 30],
  ["seo.landing.keywords", 25],
  ["seo.landing.geoFeatures", 5],
  ["sections.faq.fallbackItems", 4],
  ["sections.testimonials.items", 6],
]);

const strictTranslationFiles = new Set(
  languageFiles.filter((file) => file !== "en.json"),
);

const intentionalFallbackPaths = new Set([
  "hero.countries.in",
  "hero.countries.us",
  "hero.countries.gb",
  "hero.countries.jp",
  "hero.countries.au",
  "hero.countries.fr",
  "hero.countries.br",
  "hero.countries.ae",
  "hero.countries.sg",
  "hero.countries.de",
  "sections.analytics.engagement",
  "sections.whoIsFor.explorerLabel",
  "sections.whoIsFor.visual.creators",
  "sections.whoIsFor.visual.hostsQr",
  "header.nav.faq",
  "footer.links.faq",
  "footer.links.contact",
  "footer.sections.legal",
]);

const intentionalQuestionMarkPaths = new Set([
  "sections.faq.fallbackItems",
  "header.nav.howItWorks",
  "footer.links.howItWorks",
]);

function parseJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, part) => value?.[part], object);
}

function assertNonEmpty(value, file, dottedPath, failures) {
  if (value === undefined || value === null || value === "") {
    failures.push(`${file}: missing ${dottedPath}`);
  }
}

function assertArrayShape(value, file, dottedPath, failures) {
  const expectedLength = exactLengthPaths.get(dottedPath);
  if (expectedLength === undefined) return;
  if (!Array.isArray(value)) {
    failures.push(`${file}: ${dottedPath} must be an array`);
    return;
  }
  if (value.length !== expectedLength) {
    failures.push(
      `${file}: ${dottedPath} expected ${expectedLength} items, got ${value.length}`,
    );
  }
}

function hasEnglishFallback(value, englishValue) {
  if (typeof value === "string" && typeof englishValue === "string") {
    return value.trim() === englishValue.trim();
  }
  if (Array.isArray(value) && Array.isArray(englishValue)) {
    return JSON.stringify(value) === JSON.stringify(englishValue);
  }
  return false;
}

const english = parseJson(path.join(resourcesDir, "en.json"));
const failures = [];

for (const file of languageFiles) {
  const data = parseJson(path.join(resourcesDir, file));

  for (const dottedPath of requiredPaths) {
    const value = getPath(data, dottedPath);
    const englishValue = getPath(english, dottedPath);

    assertNonEmpty(value, file, dottedPath, failures);
    assertArrayShape(value, file, dottedPath, failures);

    const serialized = JSON.stringify(value ?? "");
    if (serialized.includes("\uFFFD")) {
      failures.push(`${file}: ${dottedPath} contains replacement character`);
    }
    if (
      !intentionalQuestionMarkPaths.has(dottedPath) &&
      serialized.includes("?") &&
      !serialized.includes("\\u003f")
    ) {
      failures.push(`${file}: ${dottedPath} contains suspicious question mark`);
    }

    if (
      strictTranslationFiles.has(file) &&
      !intentionalFallbackPaths.has(dottedPath) &&
      hasEnglishFallback(value, englishValue)
    ) {
      failures.push(`${file}: ${dottedPath} still equals English fallback`);
    }
  }

  const categories = getPath(data, "sections.productCategories.categories");
  if (Array.isArray(categories)) {
    for (const category of categories) {
      for (const key of ["id", "label", "title", "description"]) {
        if (!category[key]) failures.push(`${file}: product category missing ${key}`);
      }
    }
  }

  const steps = getPath(data, "sections.createCustomize.steps");
  if (Array.isArray(steps)) {
    for (const step of steps) {
      for (const key of ["title", "body"]) {
        if (!step[key]) failures.push(`${file}: create step missing ${key}`);
      }
    }
  }

  const cards = getPath(data, "sections.shareAnywhere.cards");
  if (Array.isArray(cards)) {
    for (const card of cards) {
      for (const key of ["title", "eyebrow"]) {
        if (!card[key]) failures.push(`${file}: share card missing ${key}`);
      }
    }
  }

  const fallbackFaqs = getPath(data, "sections.faq.fallbackItems");
  if (Array.isArray(fallbackFaqs)) {
    for (const item of fallbackFaqs) {
      for (const key of ["Sequence", "Question", "Answer"]) {
        if (!item[key]) failures.push(`${file}: FAQ fallback missing ${key}`);
      }
    }
  }

  const testimonials = getPath(data, "sections.testimonials.items");
  if (Array.isArray(testimonials)) {
    for (const item of testimonials) {
      for (const key of ["id", "name", "role", "location", "quote"]) {
        if (!item[key]) failures.push(`${file}: testimonial missing ${key}`);
      }
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Landing i18n coverage OK for ${languageFiles.length} languages.`);
