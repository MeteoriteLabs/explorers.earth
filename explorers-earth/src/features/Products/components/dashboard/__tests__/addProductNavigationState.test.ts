import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AddProductPage success navigation", () => {
  it("requests the list visibility prompt after creating a product", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/features/Products/components/dashboard/AddProductPage.tsx"),
      "utf8"
    );

    expect(source).toContain("justAddedRecommendation: true");
    expect(source).toContain("navigate(redirectBack, { state: { refetch: true, justAddedRecommendation: true } })");
    expect(source).toContain("navigate(`/recommendations/products/${listId}`, { state: { refetch: true, justAddedRecommendation: true } })");
  });
});
