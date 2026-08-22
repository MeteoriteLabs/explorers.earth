import { describe, expect, it } from "vitest";

import { resolvePublicChildState } from "../resolvePublicChildState";

describe("resolvePublicChildState", () => {
  it.each([
    [
      {
        loading: true,
        error: undefined,
        bootstrapReady: false,
        resourceKind: "child" as const,
        entityExists: false,
        empty: false,
      },
      "loading",
    ],
    [
      {
        loading: false,
        error: new Error("Forbidden"),
        bootstrapReady: true,
        resourceKind: "child" as const,
        entityExists: false,
        empty: false,
      },
      "error",
    ],
    [
      {
        loading: false,
        error: undefined,
        bootstrapReady: true,
        resourceKind: "child" as const,
        entityExists: false,
        empty: false,
      },
      "redirect",
    ],
    [
      {
        loading: false,
        error: undefined,
        bootstrapReady: true,
        resourceKind: "collection" as const,
        entityExists: true,
        empty: true,
      },
      "empty",
    ],
    [
      {
        loading: false,
        error: undefined,
        bootstrapReady: true,
        resourceKind: "child" as const,
        entityExists: true,
        empty: true,
      },
      "empty",
    ],
    [
      {
        loading: false,
        error: undefined,
        bootstrapReady: true,
        resourceKind: "child" as const,
        entityExists: true,
        empty: false,
      },
      "ready",
    ],
  ])("resolves %j as %s", (input, expected) => {
    expect(resolvePublicChildState(input)).toBe(expected);
  });
});
