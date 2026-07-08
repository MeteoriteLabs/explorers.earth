import fs from "node:fs";

const filesToScan = [
  "src/features/LandingPage/components/Hero.tsx",
  "src/features/LandingPage/components/ProductCategoriesSection.tsx",
  "src/features/LandingPage/components/CreateCustomize.tsx",
  "src/features/LandingPage/components/ShareAnywhere.tsx",
  "src/features/LandingPage/components/WhoIsFor.tsx",
  "src/features/LandingPage/components/Analytics.tsx",
  "src/features/LandingPage/components/LandingHeader.tsx",
  "src/features/LandingPage/components/UsernameClaimInput.tsx",
  "src/features/LandingPage/components/FAQ.tsx",
  "src/features/LandingPage/components/Testimonials.tsx",
  "src/pages/Landing.tsx",
  "src/features/LandingPage/components/Footer.tsx",
  "src/components/LanguageModal.tsx",
];

const forbiddenSnippets = [
  "Recommend more than places.",
  "Create one page for places, people, products, books, movies, shows, music, games, apps, and tools.",
  "Local spots, guides, and routes",
  "People worth following or learning from",
  "Products people actually recommend",
  "Apps, tools, and useful links",
  "Add what you recommend",
  "Organize it your way",
  "Share one link or QR",
  "Link in bio",
  "Profile-ready",
  "Offline-ready",
  "Chat-ready",
  "Guest-ready",
  "Welcome guide",
  "Breakfast nearby",
  "Saved recommendation",
  "Built for people whose taste helps others.",
  "Personal explorers",
  "Creators and curators",
  "Hosts and businesses",
  "Brands and organizations",
  "Choose your preferred language",
  "Search your language...",
  "No languages found",
  "Try searching with a different term",
  "languages available",
  "Press ESC to close",
  "Claim free page",
  "Claim free",
  "Validating...",
  "Try:",
  "Username is available.",
  "Username is not available.",
  "We will confirm availability on signup.",
  "Checking availability...",
  "Discover & Share Personalized Local Recommendations",
  "What can I add to my Explorer page?",
  "Can I share it with a QR code?",
  "whileHover={{ animationPlayState",
  " as any",
  "Live preview",
  "Free forever.",
  "Share anywhere",
  "Company",
  "from-blue-50",
  "to-indigo-50",
  "text-blue-600",
  "focus:ring-blue-500",
  "bg-blue-600",
];

const failures = [];

for (const file of filesToScan) {
  const text = fs.readFileSync(file, "utf8");
  for (const snippet of forbiddenSnippets) {
    if (text.includes(snippet)) {
      failures.push(
        `${file}: contains hardcoded landing/modal copy or old blue theme: ${snippet}`,
      );
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Landing hardcoded-copy check OK.");
