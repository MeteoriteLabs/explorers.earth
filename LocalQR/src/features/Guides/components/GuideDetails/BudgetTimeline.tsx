import React, { useMemo, useState } from "react";
import {
  VerticalTimeline,
  VerticalTimelineElement,
} from "react-vertical-timeline-component";
import "react-vertical-timeline-component/style.min.css";
import { BudgetPlace } from "../../types/guideSectionTypes";
import { parseBudget } from "../../utils/guideDataParser";
import { getBudgetDisplayText } from "../../utils/priceLevelUtils";
import BudgetIcon from "../../../../assets/icons/BudgetIcon";

interface BudgetTimelineProps {
  guide: {
    guide_sections?: any[];
  };
}

interface SectionGroup {
  sectionId: string;
  sectionTitle: string;
  sectionSequence: number;
  pricedPlaces: BudgetPlace[];
}

const BudgetTimeline: React.FC<BudgetTimelineProps> = ({ guide }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  const sectionGroups = useMemo(() => {
    const sections = guide.guide_sections || [];

    const uniqueSections = sections.filter(
      (section: any, index: number, self: any[]) =>
        index ===
        self.findIndex((s: any) => s.documentId === section.documentId)
    );

    const sortedSections = [...uniqueSections].sort(
      (a, b) => (a.Sequence || 0) - (b.Sequence || 0)
    );

    const groups: SectionGroup[] = [];

    sortedSections.forEach((section) => {
      const budget = parseBudget(section.Budget);
      const allPlaces: BudgetPlace[] = [
        ...(budget.morning || []),
        ...(budget.afternoon || []),
        ...(budget.evening || []),
      ];

      const pricedPlaces = allPlaces.filter(
        (p) => p && (p.customBudget || p.priceRange || typeof p.priceLevel === "number")
      );

      if (pricedPlaces.length === 0) return;

      groups.push({
        sectionId: section.documentId,
        sectionTitle: section.Title || `Day ${section.Sequence || 1}`,
        sectionSequence: section.Sequence || 0,
        pricedPlaces,
      });
    });

    return groups.sort((a, b) => a.sectionSequence - b.sectionSequence);
  }, [guide.guide_sections]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const ns = new Set(prev);
      if (ns.has(sectionId)) ns.delete(sectionId);
      else ns.add(sectionId);
      return ns;
    });
  };

  const renderPricedPlace = (place: BudgetPlace, idx: number) => {
    const badge = getBudgetDisplayText(place);
    return (
      <div
        key={`${place.place_id}-${idx}`}
        className="rounded-md border border-dashboard-muted/40 bg-dashboard-bg/30 hover:bg-dashboard-bg/50 transition-colors p-2"
      >
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 w-6 h-6 rounded-md bg-dashboard-accent/15 text-dashboard-accent flex items-center justify-center">
            <BudgetIcon />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-dashboard font-poppins font-medium text-xs truncate">
              {place.name}
            </p>
          </div>
          {badge && (
            <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-poppins bg-dashboard-accent/15 text-dashboard-accent border border-dashboard-accent/25 whitespace-nowrap">
              {badge}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (sectionGroups.length === 0) {
    return (
      <div className="bg-dashboard-sidebar rounded-lg shadow-dashboard-elevated p-6 border border-dashboard-muted">
        <h2 className="text-dashboard text-xl font-poppins font-bold mb-2">
          Budget Timeline
        </h2>
        <p className="text-dashboard-light text-sm font-poppins">
          No budget-related data found. Add places with price info in your
          sections.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-dashboard-sidebar rounded-lg shadow-dashboard-elevated p-6 border border-dashboard-muted">
      <div className="mb-6">
        <h2 className="text-dashboard text-xl font-poppins font-bold mb-2">
          Budget Timeline
        </h2>
        <p className="text-dashboard-light text-sm font-poppins">
          All places with price info grouped by day across your guide
        </p>
      </div>

      <VerticalTimeline lineColor="var(--dash-accent)">
        {sectionGroups.map((group) => (
          <VerticalTimelineElement
            key={group.sectionId}
            className="vertical-timeline-element--work"
            contentStyle={{
              background: "rgba(30, 33, 42, 0.95)",
              color: "var(--dash-text)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "16px",
              boxShadow:
                "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
              backdropFilter: "blur(10px)",
              padding: 0,
            }}
            contentArrowStyle={{
              borderRight: "7px solid rgba(255, 255, 255, 0.1)",
            }}
            iconStyle={{
              background:
                "linear-gradient(to bottom right, rgb(59 130 246), rgb(79 70 229))",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              // boxShadow handled by CSS for responsive adjustments
            }}
            icon={
              <span className="text-lg font-bold font-poppins">
                {group.sectionSequence}
              </span>
            }
          >
            <div>
              <button
                onClick={() => toggleSection(group.sectionId)}
                className="w-full flex items-center justify-between p-4 hover:bg-dashboard-bg/20 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <h3 className="text-dashboard font-poppins font-bold text-base">
                    {group.sectionTitle}
                  </h3>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-poppins font-medium bg-dashboard-accent/10 text-dashboard-accent border border-dashboard-accent/20">
                    {group.pricedPlaces.length}{" "}
                    {group.pricedPlaces.length === 1 ? "item" : "items"}
                  </span>
                </div>
              </button>

              {expandedSections.has(group.sectionId) && (
                <div className="px-4 pb-3 pt-2 border-t border-dashboard-muted/50">
                  <div className="space-y-2">
                    {group.pricedPlaces.map((place, idx) =>
                      renderPricedPlace(place, idx)
                    )}
                  </div>
                </div>
              )}
            </div>
          </VerticalTimelineElement>
        ))}
      </VerticalTimeline>
    </div>
  );
};

export default BudgetTimeline;
