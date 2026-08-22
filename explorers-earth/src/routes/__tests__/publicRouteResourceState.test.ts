import { describe, expect, it } from "vitest";

import { shouldRedirectMissingPublicResource } from "../publicRouteResourceState";

describe("shouldRedirectMissingPublicResource", () => {
  it.each([
    [true, undefined, undefined, false],
    [false, new Error("offline"), undefined, false],
    [false, undefined, { documentId: "resource-1" }, false],
    [false, undefined, null, true],
    [false, undefined, undefined, true],
  ])(
    "classifies loading=%s error=%s resource=%s as redirect=%s",
    (loading, error, resource, expected) => {
      expect(
        shouldRedirectMissingPublicResource({ loading, error, resource }),
      ).toBe(expected);
    },
  );
});
