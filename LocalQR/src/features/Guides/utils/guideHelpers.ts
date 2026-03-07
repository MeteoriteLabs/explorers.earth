/**
 * Guide Helper Functions
 * Utility functions for guide-related operations
 */

import {
  parseTimeline,
  parseTransport,
  parseStay,
  parseActivity,
  parseBudget,
} from "./guideDataParser";
import { TransportSegment } from "../types/guideSectionTypes";

/**
 * Get available tabs for a section based on its data
 */
export const getAvailableTabs = (section: any): string[] => {
  const availableTabs = [];

  // Check Timeline tab (Timeline with activities)
  if (section.Timeline) {
    const hasMorning =
      section.Timeline.morning &&
      (Array.isArray(section.Timeline.morning)
        ? section.Timeline.morning.length > 0
        : section.Timeline.morning);
    const hasAfternoon =
      section.Timeline.afternoon &&
      (Array.isArray(section.Timeline.afternoon)
        ? section.Timeline.afternoon.length > 0
        : section.Timeline.afternoon);
    const hasEvening =
      section.Timeline.evening &&
      (Array.isArray(section.Timeline.evening)
        ? section.Timeline.evening.length > 0
        : section.Timeline.evening);

    if (hasMorning || hasAfternoon || hasEvening) {
      availableTabs.push("timeline");
    }
  }

  // Check Transportation tab
  if (section.Transport) {
    const transport = parseTransport(section.Transport);
    if (transport.segments && transport.segments.length > 0) {
      availableTabs.push("transportation");
    }
  }

  // Check Stay tab
  if (section.Stay) {
    const stay = parseStay(section.Stay);
    if (stay.accommodations && stay.accommodations.length > 0) {
      availableTabs.push("stay");
    }
  }

  // Check Activities tab
  if (section.Recommendation_Activity) {
    const activities = parseActivity(section.Recommendation_Activity);
    if (activities.activities && activities.activities.length > 0) {
      availableTabs.push("activities");
    }
  }

  // Check Tips tab
  if (section.Timeline) {
    const timeline = parseTimeline(section.Timeline);
    const allPlaces = [
      ...(timeline.morning || []),
      ...(timeline.afternoon || []),
      ...(timeline.evening || []),
    ];
    const hasTips = allPlaces.some((place: any) => place.tips);
    if (hasTips) {
      availableTabs.push("tips");
    }
  }

  // Check Budget tab - based on Budget field
  if (section.Budget) {
    const budget = parseBudget(section.Budget);
    const allBudgetPlaces = [
      ...(budget.morning || []),
      ...(budget.afternoon || []),
      ...(budget.evening || []),
    ];
    const hasBudget = allBudgetPlaces.some(
      (place: any) =>
        (place.priceLevel !== undefined && place.priceLevel !== null) ||
        (place.priceRange !== undefined && place.priceRange !== null)
    );
    if (hasBudget) {
      availableTabs.push("budget");
    }
  }

  return availableTabs;
};

/**
 * Get transport segments from a section
 */
export const getTransportSegments = (section: any): TransportSegment[] => {
  if (!section.Transport) return [];
  const transport = parseTransport(section.Transport);
  return transport.segments && Array.isArray(transport.segments)
    ? transport.segments
    : [];
};

