import { describe, expect, it } from "vitest";
import { parsePublicProfileRequest, parsePublicProfileUsername } from "../../publicProfile/publicProfileContract";

describe("public profile contract", () => {
  it("bounds public page size and cursor", () => {
    expect(parsePublicProfileRequest({ username: "tk2727", category: "apps", limit: "24" })).toMatchObject({ username: "tk2727", category: "apps", limit: 24 });
    expect(() => parsePublicProfileRequest({ username: "tk2727", category: "apps", limit: "25" })).toThrow();
  });

  it("does not accept account identifiers or arbitrary request fields", () => {
    expect(() => parsePublicProfileRequest({ username: "tk2727", category: "apps", accountDocumentId: "secret" })).toThrow();
  });

  it("only accepts public usernames in route parameters", () => {
    expect(parsePublicProfileUsername(" tk2727 ")).toBe("tk2727");
    expect(() => parsePublicProfileUsername("tk2727/../admin")).toThrow();
  });
});
