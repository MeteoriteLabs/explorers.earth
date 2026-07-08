// ─────────────────────────────────────────────────────────────
// Products Feature — Public Exports
// ─────────────────────────────────────────────────────────────
export { default as PublicProducts } from "./components/public/PublicProducts";
export { default as PublicProductList } from "./components/public/PublicProductList";

// ─────────────────────────────────────────────────────────────
// Dashboard Exports
// ─────────────────────────────────────────────────────────────
export { default as ProductsHome } from "./components/dashboard/ProductsHome";
export { default as ProductListView } from "./components/dashboard/ProductListView";
export { default as AddProductPage } from "./components/dashboard/AddProductPage";

// Types
export type * from "./types";

// Utils
export * from "./utils/productHelpers";

// API
export * from "./api/query";
export * from "./api/mutation";
