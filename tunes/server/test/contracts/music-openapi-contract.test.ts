import SwaggerParser from "@apidevtools/swagger-parser";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inventoryRuntimeSurfaces } from "../../../scripts/inventory-runtime-surfaces";
import { MUSIC_OPENAPI_DOCUMENT } from "../../routes/musicOpenApiRoutes";

type Operation = {
  parameters?: Array<{ name?: string; in?: string; required?: boolean }>;
  requestBody?: unknown;
  responses?: Record<string, { headers?: Record<string, unknown> }>;
  security?: Array<Record<string, unknown>>;
};

const METHODS = ["get", "post", "patch", "delete", "put"] as const;
const root = resolve(import.meta.dirname, "../../../..");
const inventory = inventoryRuntimeSurfaces(root);

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
}

function liveCanonicalOperations(): string[] {
  return inventory.routes
    .filter((route) => [
      "strapi-identity-boundary", "local-music-owner", "paid-local-music-owner", "guest-capability",
    ].includes(route.classification) || route.path === "/api-docs")
    .map((route) => `${route.method.toLowerCase()} ${openApiPath(route.path)}`)
    .sort();
}

function documentedOperations(): string[] {
  return Object.entries(MUSIC_OPENAPI_DOCUMENT.paths).flatMap(([path, pathItem]) => METHODS
    .filter((method) => method in pathItem)
    .map((method) => `${method} ${path}`)).sort();
}

function operations(): Array<{ method: string; path: string; operation: Operation }> {
  return Object.entries(MUSIC_OPENAPI_DOCUMENT.paths).flatMap(([path, pathItem]) => METHODS.flatMap((method) => {
    const operation = (pathItem as Record<string, Operation>)[method];
    return operation ? [{ method, path, operation }] : [];
  }));
}

describe("Music OpenAPI 3.1 executable contract", () => {
  it("parses as OpenAPI 3.1 and has exact parity with every live canonical route", async () => {
    await expect(SwaggerParser.validate(MUSIC_OPENAPI_DOCUMENT as never)).resolves.toBeDefined();
    expect(documentedOperations()).toEqual(liveCanonicalOperations());
  });

  it("declares exact path parameters, status codes, schemas, and request correlation", () => {
    for (const { path, operation } of operations()) {
      for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1])) {
        expect(operation.parameters, `${path} must declare ${name}`).toContainEqual(expect.objectContaining({
          name, in: "path", required: true,
        }));
      }
      expect(Object.keys(operation.responses ?? {}), `${path} must use exact statuses`)
        .not.toEqual(expect.arrayContaining([expect.stringMatching(/^[1-5]XX$/)]));
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        expect(response.headers, `${path} ${status} must return X-Request-Id`).toHaveProperty("X-Request-Id");
      }
    }
  });

  it("documents C5, origin, guest header, publication, and entitlement semantics", () => {
    for (const { method, path, operation } of operations()) {
      const isOwner = !path.includes("/identity/ensure") && !path.includes("{guestUrl}") && path !== "/api-docs";
      if (isOwner) expect(operation.security, `${method} ${path}`).toContainEqual({ musicCredential: [] });
      if (isOwner && method !== "get" || path.endsWith("/{guestUrl}/requests")) {
        expect(operation.parameters, `${method} ${path} requires an exact Origin`).toContainEqual(expect.objectContaining({
          name: "Origin", in: "header", required: true,
        }));
      }
    }
    expect(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}"].get.parameters)
      .toContainEqual(expect.objectContaining({ name: "X-Music-Guest-Capability", in: "header", required: false }));
    expect(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}/requests"].post.parameters)
      .toContainEqual(expect.objectContaining({ name: "X-Music-Guest-Capability", in: "header", required: true }));
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}"].get)).toMatch(/unlisted.*noindex/i);
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.paths["/api/music/paid/import"].post.responses)).toContain("ENTITLEMENT_REQUIRED");
  });
});
