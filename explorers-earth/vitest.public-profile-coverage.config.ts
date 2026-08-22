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
      reportsDirectory: "coverage/public-profile",
      include: [
        "src/routes/publicRouteContract.ts",
        "src/routes/publicRouteResourceState.ts",
        "src/routes/resolvePublicChildState.ts",
        "src/layouts/publicRouteReadiness.ts",
        "src/lib/apolloTransport.ts",
      ],
      thresholds: {
        branches: 100,
      },
    },
  },
});
