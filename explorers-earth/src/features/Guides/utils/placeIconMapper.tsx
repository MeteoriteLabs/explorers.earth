import React from "react";
import Location from "../../../assets/icons/Location";
import StayIcon from "../../../assets/icons/StayIcon";

// Food/Restaurant Icon Component
const FoodIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 000 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z" />
  </svg>
);

// Temple/Religious Icon Component
const TempleIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M12 2L6.5 6.5V8h11V6.5L12 2zm6 6H6v1.5h12V8zM6 10v8h2v-6h8v6h2v-8H6zm10 8v3H8v-3h8z" />
  </svg>
);

// Museum/Landmark Icon Component
const MuseumIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M22 11V9L12 2 2 9v2h2v9H2v2h20v-2h-2v-9h2zm-4 9H6V9h12v11z" />
    <path d="M10 14h2v3h-2zm-2-2h2v5H8zm6 0h2v5h-2z" />
  </svg>
);

// Park/Nature Icon Component
const ParkIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M17 8C17 5.24 14.76 3 12 3S7 5.24 7 8c0 2.24 1.47 4.13 3.5 4.78V19H9v2h6v-2h-1.5v-6.22C15.53 12.13 17 10.24 17 8z" />
    <circle cx="12" cy="8" r="2" />
  </svg>
);

// Shopping Icon Component
const ShoppingIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
  </svg>
);

// Entertainment/Attraction Icon Component
const AttractionIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

// Cafe/Coffee Icon Component
const CafeIcon = ({
  size = "5",
  fill = "white",
}: {
  size?: string;
  fill?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill}
    className={`size-${size}`}
  >
    <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
  </svg>
);

/**
 * Maps Google Places types to appropriate icon components
 * @param types - Array of place types from Google Places API
 * @param size - Icon size (Tailwind class number as string)
 * @param fill - Icon fill color
 * @returns React element with the appropriate icon
 */
export const getPlaceIcon = (
  types: string[] = [],
  size: string = "5",
  fill: string = "white"
): React.ReactElement => {
  // Priority-based type matching (more specific types first)

  // Food & Dining
  if (
    types.some((t) =>
      [
        "restaurant",
        "cafe",
        "bakery",
        "meal_takeaway",
        "meal_delivery",
      ].includes(t)
    )
  ) {
    return <FoodIcon size={size} fill={fill} />;
  }

  if (types.includes("cafe") || types.includes("coffee")) {
    return <CafeIcon size={size} fill={fill} />;
  }

  // Lodging
  if (types.some((t) => ["lodging", "hotel", "motel", "hostel"].includes(t))) {
    return <StayIcon size={size} color={fill} />;
  }

  // Religious places
  if (
    types.some((t) =>
      [
        "hindu_temple",
        "church",
        "mosque",
        "synagogue",
        "place_of_worship",
      ].includes(t)
    )
  ) {
    return <TempleIcon size={size} fill={fill} />;
  }

  // Museums & Cultural
  if (types.some((t) => ["museum", "art_gallery", "library"].includes(t))) {
    return <MuseumIcon size={size} fill={fill} />;
  }

  // Parks & Nature
  if (
    types.some((t) => ["park", "campground", "natural_feature"].includes(t))
  ) {
    return <ParkIcon size={size} fill={fill} />;
  }

  // Shopping
  if (
    types.some((t) =>
      [
        "shopping_mall",
        "store",
        "clothing_store",
        "department_store",
        "supermarket",
      ].includes(t)
    )
  ) {
    return <ShoppingIcon size={size} fill={fill} />;
  }

  // Entertainment & Attractions
  if (
    types.some((t) =>
      [
        "tourist_attraction",
        "amusement_park",
        "aquarium",
        "zoo",
        "stadium",
        "movie_theater",
        "night_club",
        "casino",
        "bowling_alley",
        "travel_agency",
        "point_of_interest",
      ].includes(t)
    )
  ) {
    return <AttractionIcon size={size} fill={fill} />;
  }

  // Default: generic location icon
  return <Location size={size} fill={fill} />;
};

