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

function parseJson(file) {
  return JSON.parse(
    fs.readFileSync(path.join(resourcesDir, file), "utf8").replace(/^\uFEFF/, ""),
  );
}

function getPath(object, dottedPath) {
  return dottedPath.split(".").reduce((value, part) => value?.[part], object);
}

const english = parseJson("en.json");
const rows = languageFiles
  .filter((file) => file !== "en.json")
  .map((file) => {
    const data = parseJson(file);
    const row = {
      lang: file.replace(".json", ""),
      missing: 0,
      actionableEnglishFallback: 0,
      stableEnglishFallback: 0,
      suspiciousQuestion: 0,
      replacementCharacter: 0,
    };

    for (const dottedPath of requiredPaths) {
      const value = getPath(data, dottedPath);
      const englishValue = getPath(english, dottedPath);
      if (value === undefined || value === null || value === "") row.missing += 1;

      if (JSON.stringify(value) === JSON.stringify(englishValue)) {
        if (intentionalFallbackPaths.has(dottedPath)) {
          row.stableEnglishFallback += 1;
        } else {
          row.actionableEnglishFallback += 1;
        }
      }

      const serialized = JSON.stringify(value ?? "");
      if (serialized.includes("\uFFFD")) row.replacementCharacter += 1;
      if (
        !intentionalQuestionMarkPaths.has(dottedPath) &&
        serialized.includes("?") &&
        !serialized.includes("\\u003f")
      ) {
        row.suspiciousQuestion += 1;
      }
    }

    return row;
  })
  .sort(
    (a, b) =>
      b.actionableEnglishFallback - a.actionableEnglishFallback ||
      b.replacementCharacter - a.replacementCharacter ||
      b.suspiciousQuestion - a.suspiciousQuestion ||
      a.lang.localeCompare(b.lang),
  );

console.table(rows);
