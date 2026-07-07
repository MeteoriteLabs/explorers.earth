// ─────────────────────────────────────────────────────────────
// People Feature — Public Exports
// ─────────────────────────────────────────────────────────────
export { default as PublicPeople } from "./components/public/PublicPeople";
export { default as PublicPersonList } from "./components/public/PublicPersonList";
export { default as PublicPersonSector } from "./components/public/PublicPersonSector";

// ─────────────────────────────────────────────────────────────
// Dashboard Exports
// ─────────────────────────────────────────────────────────────
export { default as PeopleHome } from "./components/dashboard/PeopleHome";
export { default as PersonListView } from "./components/dashboard/PersonListView";
export { default as AddPersonPage } from "./components/dashboard/AddPersonPage";
export { default as PlatformIcon } from "./components/PlatformIcon";

// Types
export type * from "./types";

// Utils
export * from "./utils/personHelpers";

// API
export * from "./api/query";
export * from "./api/mutation";
