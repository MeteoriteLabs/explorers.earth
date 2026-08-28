import { describe, expect, it } from "vitest";
import { getMusicPublicationReadiness } from "../musicPublicationReadiness";

describe("owner Music publication readiness", () => {
  it.each([
    [{ profilePreference: "No", publicationMode: "private", statusAvailable: true }, "hidden", "Hidden from profile", "Enable profile Music"],
    [{ profilePreference: "Yes", publicationMode: "private", statusAvailable: true }, "setup-required", "Profile enabled, Music not public", "Make Music public"],
    [{ profilePreference: "No", publicationMode: "public", statusAvailable: true }, "published-hidden", "Public link active, profile tab hidden", "Show on profile"],
    [{ profilePreference: "Yes", publicationMode: "public", statusAvailable: true }, "live", "Live on profile", "View as guest"],
    [{ profilePreference: "Yes", publicationMode: "public", statusAvailable: false }, "unavailable", "Status unavailable", "Retry status"],
  ] as const)("derives $1", (input, state, label, primaryAction) => {
    expect(getMusicPublicationReadiness(input)).toMatchObject({ state, label, primaryAction });
  });
});
