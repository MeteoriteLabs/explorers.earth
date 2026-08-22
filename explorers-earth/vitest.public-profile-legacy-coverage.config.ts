import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "coverage/public-profile-legacy",
      include: [
        "src/routes/PublicProfileFallbackRedirect.tsx",
        "src/layouts/PublicProfileBootstrapContext.tsx",
        "src/layouts/PublicRouteReadinessContext.tsx",
        "src/layouts/usePublicRouteLifecycle.ts",
        "src/services/analyticsService.ts",
      ],
    },
  },
});
