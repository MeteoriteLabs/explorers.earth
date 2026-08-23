import { expect, test } from "@playwright/test";
import {
  operationNameFromRequest,
  redactAuditUrl,
  summarizeGraphqlResponse,
} from "./support/consoleNetworkAudit";
import {
  PROFILE_BACKUP_FIELDS,
  pickAllowlistedProfileState,
  removeVerifiedProfileBackup,
  writeProtectedProfileBackup,
} from "./support/liveProfileWriteSafety";

test("protected audit records only operation, status, and stable error classification", async () => {
  expect(operationNameFromRequest(JSON.stringify({
    operationName: "PublicProfileBootstrap",
    variables: { token: "must-not-survive" },
  }))).toBe("PublicProfileBootstrap");
  expect(operationNameFromRequest("not-json")).toBe("unknown");
  expect(redactAuditUrl("https://api.example/graphql?token=secret#private")).toBe(
    "https://api.example/graphql",
  );
  expect(summarizeGraphqlResponse({
    operation: "PublicProfileBootstrap",
    status: 200,
    payload: { data: { accounts: [{ email: "private@example.com" }] } },
  })).toEqual({ operation: "PublicProfileBootstrap", status: 200, code: "OK" });
  expect(summarizeGraphqlResponse({
    operation: "PublicProfileBootstrap",
    status: 403,
    payload: { errors: [{ message: "private backend detail" }] },
  })).toEqual({ operation: "PublicProfileBootstrap", status: 403, code: "GRAPHQL_ERROR" });
});

test("protected recovery artifact is versioned, OS-temporary, and removed only explicitly", async () => {
  const state = pickAllowlistedProfileState({ Bio: "baseline" });
  const artifact = await writeProtectedProfileBackup({ runId: "qa_contract", group: "bio", state });
  const fs = await import("node:fs/promises");
  const payload = JSON.parse(await fs.readFile(artifact, "utf8"));
  expect(payload).toEqual({ version: 1, runId: "qa_contract", group: "bio", state });
  await removeVerifiedProfileBackup(artifact);
  await expect(fs.access(artifact)).rejects.toThrow();
});

test("protected backup projection excludes credentials and unrelated account data", () => {
  const projected = pickAllowlistedProfileState({
    Bio: "original",
    bg_picture: null,
    profile_picture: null,
    Feed_Data: [],
    social_media: { theme_settings: { preset: "minimal-light" } },
    public_profile: "Yes",
    email: "private@example.com",
    jwt: "secret",
  });
  expect(Object.keys(projected)).toEqual(PROFILE_BACKUP_FIELDS);
  expect(JSON.stringify(projected)).not.toContain("private@example.com");
  expect(JSON.stringify(projected)).not.toContain("secret");
});
