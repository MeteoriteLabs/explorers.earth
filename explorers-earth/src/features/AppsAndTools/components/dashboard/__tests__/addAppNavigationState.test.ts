import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AddAppPage success navigation", () => {
  it("requests the list visibility prompt after creating an app", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/AppsAndTools/components/dashboard/AddAppPage.tsx"),
      "utf8"
    );

    expect(source).toContain("justAddedRecommendation: true");
    expect(source).toContain("navigate(`/recommendations/apps/${listId}`, { state: { refetch: true, justAddedRecommendation: true } })");
  });
});
