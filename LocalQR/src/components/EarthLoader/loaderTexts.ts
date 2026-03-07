/**
 * Supporting texts for the EarthLoader component.
 * Organized by context so different pages show relevant messages.
 */

export type LoaderContext =
    | "login"
    | "general"
    | "recommendations"
    | "guides"
    | "scraping"
    | "onboarding"
    | "profile"
    | "subscription";

export const LOADER_TEXTS: Record<LoaderContext, string[]> = {
    login: [
        "Explorers shape the Earth.",
        "The Earth belongs to the curious.",
        "Rooted in Earth.",
        "Built on discovery.",
        "The curious shape the world.",
        "Every explorer changes the map.",
        "Explorers of Earth.",
        "Shaped by explorers.",
        "Where exploration meets the Earth.",
        "The Earth, in motion.",
    ],

    general: [
        "Shaped by explorers.",
        "Rooted in Earth.",
        "Explorers of Earth.",
        "The curious shape the world.",
        "Built on discovery.",
        "Earth, explored.",
        "Made by the curious.",
        "The Earth, in motion.",
        "Every step leaves a story.",
        "Every place connects us.",
    ],

    recommendations: [
        "The Earth is written by explorers.",
        "Explorers leave their mark on the Earth.",
        "The Earth is built one discovery at a time.",
        "Every explorer changes the map.",
        "Exploration shapes the world.",
        "The Earth grows through discovery.",
        "The map begins with the Earth.",
        "Every place connects us.",
        "Shaped by explorers.",
        "Built on discovery.",
    ],

    guides: [
        "Explorers build the map.",
        "The map belongs to those who explore.",
        "The Earth is mapped by those who walk it.",
        "The world moves with the curious.",
        "The Earth remembers its explorers.",
        "Rooted in the Earth. Driven by curiosity.",
        "Where exploration meets the Earth.",
        "Every step leaves a story.",
        "The Earth grows through discovery.",
        "Exploration shapes the world.",
    ],

    scraping: [
        "The Earth is written by explorers.",
        "Every step leaves a story.",
        "The Earth is built one discovery at a time.",
        "Explorers build the map.",
        "The Earth, in motion.",
        "Made by the curious.",
        "The world moves with the curious.",
        "The Earth remembers its explorers.",
        "Earth, explored.",
        "Every place connects us.",
    ],

    onboarding: [
        "Explorers shape the Earth.",
        "The map belongs to those who explore.",
        "Welcome to the community of explorers.",
        "Rooted in the Earth. Driven by curiosity.",
        "The Earth belongs to the curious.",
        "Built on discovery.",
        "Every explorer changes the map.",
        "The curious shape the world.",
        "Shaped by explorers.",
        "The Earth grows through discovery.",
    ],

    profile: [
        "Explorers leave their mark on the Earth.",
        "The Earth remembers its explorers.",
        "Every step leaves a story.",
        "Shaped by explorers.",
        "The map belongs to those who explore.",
        "Rooted in Earth.",
        "Explorers of Earth.",
        "Built on discovery.",
        "Every place connects us.",
        "The Earth is mapped by those who walk it.",
    ],

    subscription: [
        "The Earth belongs to the curious.",
        "Explorers build the map.",
        "Built on discovery.",
        "The curious shape the world.",
        "Explorers of Earth.",
        "The Earth, in motion.",
        "Made by the curious.",
        "Every explorer changes the map.",
        "Exploration shapes the world.",
        "Where exploration meets the Earth.",
    ],
};

/**
 * Get a shuffled copy of texts for a given context.
 * This ensures each load shows texts in a different order.
 */
export const getShuffledTexts = (context: LoaderContext): string[] => {
    const texts = [...LOADER_TEXTS[context]];
    for (let i = texts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [texts[i], texts[j]] = [texts[j], texts[i]];
    }
    return texts;
};
