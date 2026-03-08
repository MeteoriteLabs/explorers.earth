/**
 * BudgetView Component
 * Displays budget information for places in the section
 */

import React from "react";
import { BudgetPlace } from "../../../../types/guideSectionTypes";
import { parseBudget } from "../../../../utils/guideDataParser";
import { getBudgetDisplayText } from "../../../../utils/priceLevelUtils";
import BudgetIcon from "../../../../../../assets/icons/BudgetIcon";

interface BudgetViewProps {
  budget: any;
}

const BudgetView: React.FC<BudgetViewProps> = ({ budget }) => {
  if (!budget) return null;

  const budgetData = parseBudget(budget);
  const allPlaces: BudgetPlace[] = [
    ...(budgetData.morning || []),
    ...(budgetData.afternoon || []),
    ...(budgetData.evening || []),
  ];

  // Filter places with budget information (customBudget, priceRange, or priceLevel)
  const pricedPlaces = allPlaces.filter(
    (place) =>
      place &&
      (place.customBudget || place.priceRange || typeof place.priceLevel === "number")
  );

  if (pricedPlaces.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 text-dashboard-light opacity-50">
          <BudgetIcon size="12" />
        </div>
        <p className="text-dashboard-light text-sm font-poppins">
          No budget information available for this section
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-dashboard text-lg font-poppins font-semibold mb-4 flex items-center gap-2">
        <BudgetIcon size="5" />
        Budget Information
      </h3>
      
      <div className="bg-dashboard-bg rounded-lg p-4 border border-dashboard-muted">
        <p className="text-dashboard-light text-sm font-poppins mb-4">
          {pricedPlaces.length} {pricedPlaces.length === 1 ? "place" : "places"} with pricing information
        </p>
        
        <div className="space-y-3">
          {pricedPlaces.map((place, idx) => {
            const badge = getBudgetDisplayText(place);
            return (
              <div
                key={`${place.place_id}-${idx}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-dashboard-muted/40 bg-dashboard-sidebar hover:bg-dashboard-bg/50 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dashboard-accent/15 text-dashboard-accent flex items-center justify-center mt-0.5">
                  <BudgetIcon />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-dashboard font-poppins font-medium text-sm mb-1">
                    {place.name}
                  </h4>
                </div>
                
                {badge && (
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-poppins font-semibold bg-dashboard-accent/15 text-dashboard-accent border border-dashboard-accent/25">
                      {badge}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-dashboard-muted">
          <p className="text-dashboard-light text-xs font-poppins">
            <span className="font-semibold">Budget Info:</span> Displays custom budgets or Google Places pricing data. Price levels: Free, Inexpensive, Moderate, Expensive, Very Expensive.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BudgetView;
