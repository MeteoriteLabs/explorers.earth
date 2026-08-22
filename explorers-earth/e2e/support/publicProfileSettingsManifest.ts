import type { LayoutId, PresetId, WallpaperMode } from "./publicProfileFixture";
import {
  PUBLIC_PROFILE_ACCENT_COLORS,
  PUBLIC_PROFILE_FIRST_VIEWS,
} from "../../src/features/Profile/constants/recommendationsPresentation";

export const PROFILE_THEMES = [
  "cinematic-dark",
  "glassmorphism",
  "sunset-glow",
  "minimal-light",
  "emerald-nature",
  "neon-cyber",
] as const satisfies readonly PresetId[];

export const PROFILE_WALLPAPERS = [
  "solid-color",
  "banner-top",
  "full-wallpaper-image",
  "ambient-gradient",
] as const satisfies readonly WallpaperMode[];

export const THEME_WALLPAPER_CASES = PROFILE_THEMES.flatMap((theme) =>
  PROFILE_WALLPAPERS.map((wallpaper) => ({
    id: `${theme}--${wallpaper}`,
    theme,
    wallpaper,
  })),
);

export const SECONDARY_SETTING_FACTORS = {
  hero: ["present", "absent", "broken"],
  footer: ["enabled", "minimal", "disabled"],
  recommendationLayout: ["shelves", "grid", "featured"],
  categoryOrder: ["canonical", "reverse", "rotate", "preferred-first"],
  bio: ["empty", "plain", "long-rich-text"],
  social: ["none", "visible", "hidden"],
  gallery: ["empty", "instagram", "google", "upload"],
} as const satisfies {
  readonly hero: readonly string[];
  readonly footer: readonly string[];
  readonly recommendationLayout: readonly LayoutId[];
  readonly categoryOrder: readonly string[];
  readonly bio: readonly string[];
  readonly social: readonly string[];
  readonly gallery: readonly string[];
};

export type SecondarySettingFactor = keyof typeof SECONDARY_SETTING_FACTORS;
export type SecondarySettingsRow = {
  [Name in SecondarySettingFactor]: (typeof SECONDARY_SETTING_FACTORS)[Name][number];
};

const SECONDARY_FACTOR_NAMES = Object.keys(
  SECONDARY_SETTING_FACTORS,
) as SecondarySettingFactor[];

function settingPair(
  leftName: SecondarySettingFactor,
  leftValue: string,
  rightName: SecondarySettingFactor,
  rightValue: string,
) {
  return `${leftName}=${leftValue}|${rightName}=${rightValue}`;
}

export function rowSettingPairs(row: SecondarySettingsRow) {
  const pairs: string[] = [];
  for (let left = 0; left < SECONDARY_FACTOR_NAMES.length; left += 1) {
    for (let right = left + 1; right < SECONDARY_FACTOR_NAMES.length; right += 1) {
      const leftName = SECONDARY_FACTOR_NAMES[left];
      const rightName = SECONDARY_FACTOR_NAMES[right];
      pairs.push(settingPair(leftName, row[leftName], rightName, row[rightName]));
    }
  }
  return pairs;
}

export function allRequiredSettingPairs() {
  const required = new Set<string>();
  for (let left = 0; left < SECONDARY_FACTOR_NAMES.length; left += 1) {
    for (let right = left + 1; right < SECONDARY_FACTOR_NAMES.length; right += 1) {
      const leftName = SECONDARY_FACTOR_NAMES[left];
      const rightName = SECONDARY_FACTOR_NAMES[right];
      for (const leftValue of SECONDARY_SETTING_FACTORS[leftName]) {
        for (const rightValue of SECONDARY_SETTING_FACTORS[rightName]) {
          required.add(settingPair(leftName, leftValue, rightName, rightValue));
        }
      }
    }
  }
  return required;
}

function allSecondaryRows() {
  const rows: SecondarySettingsRow[] = [];
  const build = (index: number, partial: Partial<SecondarySettingsRow>) => {
    if (index === SECONDARY_FACTOR_NAMES.length) {
      rows.push(partial as SecondarySettingsRow);
      return;
    }
    const name = SECONDARY_FACTOR_NAMES[index];
    for (const value of SECONDARY_SETTING_FACTORS[name]) {
      build(index + 1, { ...partial, [name]: value });
    }
  };
  build(0, {});
  return rows;
}

export function generateSecondaryPairwiseCases() {
  const candidates = allSecondaryRows().map((row) => ({
    row,
    pairs: rowSettingPairs(row),
  }));
  const uncovered = allRequiredSettingPairs();
  const selected: SecondarySettingsRow[] = [];

  while (uncovered.size > 0) {
    let bestIndex = -1;
    let bestScore = -1;
    for (let index = 0; index < candidates.length; index += 1) {
      const score = candidates[index].pairs.reduce(
        (total, pair) => total + Number(uncovered.has(pair)),
        0,
      );
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }

    if (bestIndex < 0 || bestScore <= 0) {
      throw new Error(`Unable to cover ${uncovered.size} secondary setting pairs`);
    }

    const [best] = candidates.splice(bestIndex, 1);
    selected.push(best.row);
    best.pairs.forEach((pair) => uncovered.delete(pair));
  }

  return selected;
}

export const PUBLIC_PROFILE_SETTINGS_MANIFEST = {
  themeWallpaperCases: THEME_WALLPAPER_CASES,
  secondaryFactors: SECONDARY_SETTING_FACTORS,
  accentColors: PUBLIC_PROFILE_ACCENT_COLORS.map((color) => color.hex),
  accentColorCases: PUBLIC_PROFILE_ACCENT_COLORS.map((color) => ({
    id: `accent--${color.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ...color,
  })),
  firstViews: PUBLIC_PROFILE_FIRST_VIEWS,
  firstViewCases: PUBLIC_PROFILE_FIRST_VIEWS.map((value) => ({
    id: `first-view--${value}`,
    value,
  })),
  viewports: [
    { id: "mobile-320", width: 320, height: 812 },
    { id: "mobile-short", width: 375, height: 667 },
    { id: "tablet-768", width: 768, height: 900 },
    { id: "desktop-1024", width: 1024, height: 900 },
    { id: "desktop-1440", width: 1440, height: 900 },
  ],
  zoom: [1, 2],
  motion: ["no-preference", "reduce"],
} as const;

const artifactPart = (value: string) => value
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "");

export function settingsArtifactName(input: {
  project: string;
  caseId: string;
  viewport: { width: number; height: number };
  attempt: number;
}) {
  return [
    artifactPart(input.project),
    artifactPart(input.caseId),
    `${input.viewport.width}x${input.viewport.height}`,
    `attempt-${input.attempt}`,
  ].join("--") + ".png";
}
