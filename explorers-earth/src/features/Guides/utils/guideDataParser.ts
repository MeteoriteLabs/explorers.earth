/**
 * Utility functions for parsing guide section data
 * Handles JSON string parsing for Timeline, Transport, Stay, and Activity data
 */

import type {
  TimelineData,
  TransportData,
  StayData,
  ActivityData,
  BudgetData,
} from "../types/guideSectionTypes";

export type { TimelineData, TransportData, StayData, ActivityData, BudgetData };

/**
 * Generic function to parse section data that may be a JSON string or an object
 * @param data - Data that may be a JSON string or already parsed object
 * @returns Parsed object of type T
 */
export const parseSectionData = <T>(data: string | T | null | undefined): T => {
  if (!data) {
    return {} as T;
  }

  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      console.error("Error parsing JSON data:", error);
      return {} as T;
    }
  }

  return data as T;
};

/**
 * Parse Timeline data from guide section
 * @param timeline - Timeline data as string or object
 * @returns Parsed TimelineData
 */
export const parseTimeline = (
  timeline: string | TimelineData | null | undefined
): TimelineData => {
  const parsed = parseSectionData<TimelineData>(timeline);
  return {
    morning: parsed.morning || [],
    afternoon: parsed.afternoon || [],
    evening: parsed.evening || [],
  };
};

/**
 * Parse Transport data from guide section
 * @param transport - Transport data as string or object
 * @returns Parsed TransportData
 */
export const parseTransport = (
  transport: string | TransportData | null | undefined
): TransportData => {
  const parsed = parseSectionData<TransportData>(transport);
  return {
    segments: parsed.segments || [],
  };
};

/**
 * Parse Stay data from guide section
 * @param stay - Stay data as string or object
 * @returns Parsed StayData
 */
export const parseStay = (
  stay: string | StayData | null | undefined
): StayData => {
  const parsed = parseSectionData<StayData>(stay);
  return {
    accommodations: parsed.accommodations || [],
  };
};

/**
 * Parse Activity data from guide section
 * @param activity - Activity data as string or object
 * @returns Parsed ActivityData
 */
export const parseActivity = (
  activity: string | ActivityData | null | undefined
): ActivityData => {
  const parsed = parseSectionData<ActivityData>(activity);
  return {
    activities: parsed.activities || [],
  };
};

/**
 * Parse Budget data from guide section
 * @param budget - Budget data as string or object
 * @returns Parsed BudgetData
 */
export const parseBudget = (
  budget: string | BudgetData | null | undefined
): BudgetData => {
  const parsed = parseSectionData<BudgetData>(budget);
  return {
    morning: parsed.morning || [],
    afternoon: parsed.afternoon || [],
    evening: parsed.evening || [],
  };
};
