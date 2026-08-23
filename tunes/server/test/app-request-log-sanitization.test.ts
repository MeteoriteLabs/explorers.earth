import { describe, expect, it } from "vitest";
import { sanitizedRequestLogTarget } from "../app";

describe("application request log target", () => {
  it("drops query credentials instead of logging reactivation tokens", () => {
    expect(sanitizedRequestLogTarget({ path: "/api/user/reactivate" }))
      .toBe("/api/user/reactivate");
  });
});
