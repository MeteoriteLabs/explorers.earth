import { describe, expect, it } from "vitest";
import { validateStrapiFixture } from "../../../scripts/music-cli.ts";

describe("Strapi identity fixture contract", () => {
  it("rejects a live fixture capture without an explicit read-only credential", () => {
    // Production break caught: a live probe could silently fall back to ambient
    // credentials and expose or mutate a production Strapi tenant.
    expect(() =>
      validateStrapiFixture(
        {
          schemaVersion: "strapi-identity-fixture/v1",
          fixtureVersion: "1",
          identities: [
            {
              user: { id: "person-1" },
              accounts: [{ id: "account-1", completed: true }],
            },
          ],
        },
        { mode: "live", readOnlyCredential: undefined },
      ),
    ).toThrow("LIVE_STRAPI_READ_ONLY_CREDENTIAL is required");
  });

  it("rejects a fixture that omits the immutable person identifier", () => {
    // Production break caught: provisioning could create Music state for an
    // anonymous or remapped person.
    expect(() =>
      validateStrapiFixture(
        {
          schemaVersion: "strapi-identity-fixture/v1",
          fixtureVersion: "1",
          identities: [{ user: {}, accounts: [{ id: "account-1", completed: true }] }],
        },
        { mode: "fixture" },
      ),
    ).toThrow("identity[0].user.id is required");
  });

  it("rejects ambiguous completed Account selections", () => {
    // Production break caught: a person could be bound to the wrong Account.
    expect(() =>
      validateStrapiFixture(
        {
          schemaVersion: "strapi-identity-fixture/v1",
          fixtureVersion: "1",
          identities: [
            {
              user: { id: "person-1" },
              accounts: [
                { id: "account-1", completed: true },
                { id: "account-2", completed: true },
              ],
            },
          ],
        },
        { mode: "fixture" },
      ),
    ).toThrow("identity[0] has ambiguous completed Accounts");
  });

  it("rejects schema drift and truncated pagination metadata", () => {
    // Production break caught: an incomplete or changed Strapi list response
    // would silently skip eligible people during provisioning.
    expect(() =>
      validateStrapiFixture(
        {
          schemaVersion: "strapi-identity-fixture/v0" as "strapi-identity-fixture/v1",
          fixtureVersion: "1",
          identities: [],
          pagination: { page: 1, pageCount: 2 },
        },
        { mode: "fixture" },
      ),
    ).toThrow("unsupported fixture schema");
  });

  it("rejects truncated pagination metadata", () => {
    // Production break caught: the final page can be silently omitted.
    expect(() =>
      validateStrapiFixture(
        {
          schemaVersion: "strapi-identity-fixture/v1",
          fixtureVersion: "1",
          identities: [],
          pagination: { page: 1, pageCount: 1, pageSize: 100 },
        },
        { mode: "fixture" },
      ),
    ).toThrow("pagination metadata is truncated");
  });

  it("rejects a service token fixture with a write operation", () => {
    // Production break caught: a read-only preflight credential could delete
    // production identity records.
    expect(() =>
      validateStrapiFixture(
        {
          schemaVersion: "strapi-identity-fixture/v1",
          fixtureVersion: "1",
          identities: [],
          serviceToken: { operations: ["GET /api/users", "DELETE /api/users/person-1"] },
        },
        { mode: "fixture" },
      ),
    ).toThrow("service token operation must be read-only");
  });
});
