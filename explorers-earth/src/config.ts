// image config for aspect ratio for crop
export const IMAGE_CONFIG = {
  aspectRatios: {
    profilePicture: 1,
    backgroundPicture: 2,
    guideCover: 16 / 9, // 16:9 widescreen for guide cover images
  },
  defaultImages: {
    profile: "/images/Profile.jpg",
    background: "/images/Background.jpg",
    // Inline SVG placeholder for missing place/recommendation images
    // Dark gradient with subtle landscape scene — no external requests
    place: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'><defs><linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%231a2332'/><stop offset='100%25' stop-color='%230d1520'/></linearGradient><linearGradient id='ground' x1='0' y1='0' x2='0' y2='1'><stop offset='0%25' stop-color='%23243040'/><stop offset='100%25' stop-color='%231a2332'/></linearGradient></defs><rect width='400' height='400' fill='url(%23bg)'/><ellipse cx='200' cy='420' rx='260' ry='100' fill='url(%23ground)'/><polygon points='60,280 140,160 220,280' fill='%232a3d52' opacity='0.9'/><polygon points='140,280 240,120 340,280' fill='%23243040' opacity='0.9'/><polygon points='180,280 260,155 340,280' fill='%231e3045' opacity='0.7'/><circle cx='80' cy='90' r='18' fill='%23f5c842' opacity='0.18'/><circle cx='80' cy='90' r='10' fill='%23f5c842' opacity='0.28'/><circle cx='320' cy='70' r='4' fill='white' opacity='0.5'/><circle cx='290' cy='55' r='3' fill='white' opacity='0.4'/><circle cx='350' cy='90' r='2.5' fill='white' opacity='0.35'/><circle cx='260' cy='40' r='2' fill='white' opacity='0.4'/><path d='M200 175 L210 205 L200 200 L190 205 Z' fill='%233d8ef0' opacity='0.85'/><circle cx='200' cy='170' r='16' fill='%233d8ef0' opacity='0.85'/><circle cx='200' cy='170' r='8' fill='white' opacity='0.9'/></svg>`,
  },
};

// base usrl for google places api
export const GOOGLE_PLACES_API_BASE_URL =
  "https://places.googleapis.com/v1/places";

export const GOOGLE_GEOCODING_BASE_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";

// ─── TMDB (The Movie Database) config ──────────────────────
export const TMDB_API_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// Poster widths available on TMDB CDN
export const TMDB_POSTER_SIZE = {
  xs: "w92",
  sm: "w185",
  md: "w342",
  lg: "w500",
  xl: "w780",
  original: "original",
} as const;

// Backdrop widths available on TMDB CDN
export const TMDB_BACKDROP_SIZE = {
  sm: "w300",
  md: "w780",
  lg: "w1280",
  original: "original",
} as const;
