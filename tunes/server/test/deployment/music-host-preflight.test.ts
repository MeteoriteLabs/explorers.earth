import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script, createContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

type StatusCategory = "success" | "client_error" | "server_error" | "transport_or_validation_error";
interface Sample { success: boolean; latencyMs: number; statusCategory: StatusCategory }
interface ProbeLibrary {
  validateEnsurePayload: (text: string, nowMs: number) => unknown;
  evaluateSlo: (samples: { cold: Sample[]; warm: Sample[]; concurrent: Sample[] }) => {
    passed: boolean; sampleCount: number; successCount: number; successRatePercent: number;
    gatewayProofCacheTtlColdP95Ms: number; warmP95Ms: number; concurrentP95Ms: number;
    statusCategoryCounts: Record<StatusCategory, number>;
  };
  probeEnsure: (input: {
    proof: string; fetchImpl: typeof fetch; monotonicNow?: () => number;
    wallNow?: () => number; timeoutMs?: number;
  }) => Promise<Sample>;
  runQualification: (input: {
    proof: string;
    probe?: (input: { proof: string }) => Promise<Sample>;
    sleepImpl?: (milliseconds: number) => Promise<void>;
    cacheTtlMs: number;
  }) => Promise<{ cold: Sample[]; warm: Sample[]; concurrent: Sample[] }>;
}

interface PreflightLibrary {
  assertBearerLifetime: (proof: string, nowMs: number) => void;
  validateProvisionedBearer: (input: {
    proof: string;
    expectedMusicUserId: number;
    fetchImpl: typeof fetch;
    wallNow?: () => number;
    timeoutMs?: number;
  }) => Promise<void>;
}

function sloJob() {
  const workflow = parseYaml(read(".github/workflows/tunes-host-preflight.yml"));
  return { workflow, job: workflow.jobs["authenticated-identity-slo"] };
}

function remoteScript(): string {
  const { job } = sloJob();
  return String(job.steps.find((step: any) =>
    step.name === "Probe authenticated identity SLO without identity output").with.script);
}

function embeddedNodeSource(): string {
  const match = /docker exec -e MUSIC_SLO_EXECUTE=1 -e MUSIC_SLO_STRAPI_USER_TOKEN -i tunes-app-1 node <<'NODE' \|\| sampling_status=\$\?\n([\s\S]*?)\nNODE(?:\n|$)/.exec(remoteScript());
  if (!match) throw new Error("embedded probe source missing");
  return match[1];
}

function preflightNodeSource(): string {
  const match = /docker exec -e MUSIC_SLO_PREFLIGHT=1 -e MUSIC_SLO_STRAPI_USER_TOKEN -i tunes-app-1 node <<'PREFLIGHT'\n([\s\S]*?)\nPREFLIGHT(?:\n|$)/.exec(remoteScript());
  if (!match) throw new Error("embedded bearer preflight source missing");
  return match[1];
}

function publishedBindingSelectorSource(): string {
  const script = remoteScript();
  const start = script.indexOf("select_published_readiness_binding() {");
  const end = script.indexOf("\n}", start);
  if (start < 0 || end < 0) throw new Error("published binding selector missing");
  return script.slice(start, end + 2);
}

function selectPublishedBinding(bindings: string) {
  const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
  const encoded = Buffer.from(bindings, "utf8").toString("base64");
  return spawnSync(bash, ["-c", `${publishedBindingSelectorSource()}\nbindings="$(printf '%s' "$1" | base64 --decode)"\nselect_published_readiness_binding <<< "$bindings"`, "--", encoded], {
    encoding: "utf8",
  });
}

function probeLibrary(): ProbeLibrary {
  const module = { exports: {} as unknown };
  const context = createContext({
    AbortController, AbortSignal, Buffer, URL, URLSearchParams, clearTimeout,
    console: { log: vi.fn() },
    fetch: vi.fn(async () => { throw new Error("unexpected fetch"); }),
    module,
    process: { env: {}, exitCode: 0 },
    require,
    setTimeout,
  });
  new Script(embeddedNodeSource(), { filename: "embedded-music-identity-slo.cjs" }).runInContext(context);
  return module.exports as ProbeLibrary;
}

function preflightLibrary(): PreflightLibrary {
  const module = { exports: {} as unknown };
  const context = createContext({
    AbortController, AbortSignal, Buffer, URL, clearTimeout,
    fetch: vi.fn(async () => { throw new Error("unexpected fetch"); }),
    module,
    process: { env: {}, exitCode: 0 },
    require,
    setTimeout,
  });
  new Script(preflightNodeSource(), { filename: "embedded-music-identity-bearer-preflight.cjs" }).runInContext(context);
  return module.exports as PreflightLibrary;
}

const credentialToken = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(32)}`;
const preflightNowMs = 1_900_000_000_000;
const bearerWithExpiration = (expiresAtSeconds: number | string) => [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ exp: expiresAtSeconds })).toString("base64url"),
  "signature-not-verified-locally",
].join(".");
const validPayload = (expiresAt = 2_000_000_000_000) => JSON.stringify({
  version: "music-identity/v1",
  identity: { musicUserId: 17, status: "active" },
  credential: { token: credentialToken, expiresAt },
});
const sample = (
  latencyMs: number,
  success = true,
  statusCategory: StatusCategory = success ? "success" : "transport_or_validation_error",
): Sample => ({ success, latencyMs, statusCategory });

afterEach(() => vi.useRealTimers());

describe("Tunes authenticated identity SLO preflight", () => {
  it("requires an exact deployed commit and remains restricted to the fingerprint diagnostic branch", () => {
    const { workflow, job } = sloJob();
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.expected_deployed_commit).toEqual({
      description: "Exact 40-character commit currently deployed to the Tunes test app",
      required: true,
      type: "string",
    });
    expect(job.if).toContain("github.ref == 'refs/heads/codex/tunes-fingerprint-diagnostic'");
    expect(job.if).toContain("inputs.run_authenticated_identity_slo");
    expect(job.if).toContain("!inputs.confirm_test_deploy");
    expect(job.if).toContain("!inputs.diagnose_last_attempt");
    expect(job.env).toEqual({
      EXPECTED_DEPLOYED_COMMIT: "${{ inputs.expected_deployed_commit }}",
      MUSIC_SLO_STRAPI_USER_TOKEN: "${{ secrets.MUSIC_SLO_STRAPI_USER_TOKEN }}",
    });
    expect(workflow.jobs["diagnose-last-attempt"].if).toContain("!inputs.run_authenticated_identity_slo");
    expect(workflow.jobs["build-arm64"].if).toContain("!inputs.run_authenticated_identity_slo");
    expect(job["runs-on"]).toBe("ubuntu-24.04");
    expect(job["timeout-minutes"]).toBe(35);
    expect(job.permissions).toEqual({ contents: "read" });
  });

  it("attests the immutable test image and commit before exactly one guarded restart", () => {
    const { job } = sloJob();
    const remote = job.steps.find((step: any) => step.name === "Probe authenticated identity SLO without identity output");
    expect(remote.uses).toBe("appleboy/ssh-action@2ead5e36573f08b82fbfce1504f1a4b05a647c6f");
    expect(remote.with).toMatchObject({
      host: "${{ secrets.TUNES_DEPLOY_HOST }}", username: "deploy", key: "${{ secrets.TUNES_DEPLOY_KEY }}",
      fingerprint: "SHA256:mkzoRIglhalq6lNwNgM2kyuRLFGLeIbpLQpypShYMSw",
      command_timeout: "30m", envs: "EXPECTED_DEPLOYED_COMMIT,MUSIC_SLO_STRAPI_USER_TOKEN",
    });
    const script = remoteScript();
    expect(script).toContain('[[ "$EXPECTED_DEPLOYED_COMMIT" =~ ^[a-f0-9]{40}$ ]]');
    expect(script).toContain('test "$container_commit" = "$EXPECTED_DEPLOYED_COMMIT"');
    expect(script).toContain('test "$image_revision" = "$EXPECTED_DEPLOYED_COMMIT"');
    expect(script).toContain('[[ "$configured_image" =~ ^ghcr\\.io/[a-z0-9._-]+/explorers-tunes-test@sha256:[a-f0-9]{64}$ ]]');
    expect(script).toContain(`test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' tunes-app-1)" = tunes`);
    expect(script).toContain(`test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' tunes-app-1)" = app`);
    expect(script.match(/docker restart --time 30 tunes-app-1/g)).toHaveLength(1);
    expect(script).toContain("docker restart --time 30 tunes-app-1 >/dev/null");
    expect(script).toContain(`test "$ready" = true`);
    expect(script).toContain("docker exec -e MUSIC_SLO_EXECUTE=1 -e MUSIC_SLO_STRAPI_USER_TOKEN -i tunes-app-1 node");
    expect(script).not.toContain("MUSIC_SLO_UNIT_TEST");
    expect(script).not.toMatch(/docker\s+compose\s+(?:up|down|restart|rm|pull|build)/);
    expect(script).not.toMatch(/docker\s+(?:stop|rm|rmi|prune)/);
  });

  it("passes only a masked dedicated user bearer by environment name and contains it after use", () => {
    const script = remoteScript();
    expect(script).toContain('[[ "${MUSIC_SLO_STRAPI_USER_TOKEN:-}" =~ ^[A-Za-z0-9._~-]{16,4096}$ ]]');
    expect(script).toContain("docker exec -e MUSIC_SLO_PREFLIGHT=1 -e MUSIC_SLO_STRAPI_USER_TOKEN -i tunes-app-1 node");
    expect(script).toContain("docker exec -e MUSIC_SLO_EXECUTE=1 -e MUSIC_SLO_STRAPI_USER_TOKEN -i tunes-app-1 node");
    expect(script).not.toMatch(/-e MUSIC_SLO_STRAPI_USER_TOKEN=/);
    expect(script).not.toContain("${{ secrets.MUSIC_SLO_STRAPI_USER_TOKEN }}");
    expect(script.match(/delete process\.env\.MUSIC_SLO_STRAPI_USER_TOKEN/g)).toHaveLength(2);
    expect(script).toContain("unset MUSIC_SLO_STRAPI_USER_TOKEN");
    expect(script).not.toContain("STRAPI_JWT_SECRET");
    expect(script).not.toContain('require("jsonwebtoken")');
    expect(script).not.toContain("jwt.sign");
  });

  it("derives and guards the published test-app readiness binding while probing ensure inside the container", () => {
    const script = remoteScript();
    const shell = script.slice(0, script.indexOf("docker exec -e MUSIC_SLO_PREFLIGHT=1"));
    expect(shell).toContain(`published_binding_rows="$(docker inspect --format '{{range (index .NetworkSettings.Ports "5000/tcp")}}{{printf "%s|%s\\n" .HostIp .HostPort}}{{end}}' tunes-app-1)"`);
    expect(shell).toContain('published_binding_selection="$(select_published_readiness_binding <<< "$published_binding_rows")"');
    expect(shell).toContain('published_probe_host="${published_binding_selection%%|*}"');
    expect(shell).toContain('published_host_port="${published_binding_selection##*|}"');
    expect(shell).toContain('published_ready_url="http://${published_probe_host}:${published_host_port}/health/ready"');
    expect(script).toContain('curl --fail --silent --show-error --max-time 2 "$published_ready_url"');
    expect(script).not.toContain("curl --fail --silent --show-error --max-time 2 http://127.0.0.1:5000");
    expect(embeddedNodeSource()).toContain('new URL("/api/music/identity/ensure", "http://127.0.0.1:5000")');
  });

  it("executes the published binding guard for single and dual-stack same-port bindings", () => {
    expect(selectPublishedBinding("127.0.0.1|5001")).toMatchObject({
      status: 0,
      stdout: "127.0.0.1|5001\n",
    });
    expect(selectPublishedBinding("0.0.0.0|5001\n::|5001")).toMatchObject({
      status: 0,
      stdout: "127.0.0.1|5001\n",
    });
    expect(selectPublishedBinding("::1|5001")).toMatchObject({
      status: 0,
      stdout: "[::1]|5001\n",
    });
  });

  it("fails closed for absent, excessive, unsafe, malformed, or conflicting published bindings", () => {
    for (const bindings of [
      "",
      "0.0.0.0|5001\n::|5001\n127.0.0.1|5001",
      "192.168.1.20|5001",
      "0.0.0.0|nope",
      "0.0.0.0|0",
      "0.0.0.0|65536",
      "0.0.0.0|5001\n::|5002",
    ]) {
      const result = selectPublishedBinding(bindings);
      expect(result.status, bindings || "<absent>").not.toBe(0);
    }
  });

  it("reports only a fixed sanitized shell failure stage before sampling", () => {
    const shell = remoteScript().slice(0, remoteScript().indexOf("docker exec -e MUSIC_SLO_EXECUTE=1"));
    const diagnostic = shell.split("\n").find((line) => line.includes("music-identity-slo-stage/v1"));
    expect(diagnostic).toContain('"schemaVersion":"music-identity-slo-stage/v1"');
    expect(diagnostic).toContain('"outcome":"failed_closed"');
    expect(shell).toContain('failure_stage=published_binding_attestation');
    expect(diagnostic).not.toContain("hostIp");
    expect(diagnostic).not.toContain("hostPort");
    expect(diagnostic).not.toContain("published_binding_rows");
  });

  it("silently proves the real bearer maps to the selected provisioned Music identity before restart", async () => {
    const script = remoteScript();
    expect(preflightNodeSource()).toMatch(/SELECT\s+id\s+FROM users\s+WHERE identity_status='active'\s+ORDER BY id ASC LIMIT 1/);
    expect(script.indexOf("MUSIC_SLO_PREFLIGHT=1")).toBeLessThan(script.indexOf("docker restart --time 30"));
    const { validateProvisionedBearer } = preflightLibrary();
    const longLivedBearer = bearerWithExpiration(preflightNowMs / 1_000 + 2_401);
    let authorization = "";
    const fetchMock = vi.fn(async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return { status: 200, text: async () => validPayload(), body: { locked: false, cancel: vi.fn() } } as unknown as Response;
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;
    await expect(validateProvisionedBearer({
      proof: longLivedBearer,
      expectedMusicUserId: 17,
      fetchImpl,
      wallNow: () => preflightNowMs,
    })).resolves.toBeUndefined();
    expect(authorization).toBe(`Bearer ${longLivedBearer}`);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty("body");

    const unauthorized = vi.fn(async () => ({
      status: 401, text: async () => "not read", body: { locked: false, cancel: vi.fn() },
    })) as unknown as typeof fetch;
    await expect(validateProvisionedBearer({
      proof: longLivedBearer, expectedMusicUserId: 17, fetchImpl: unauthorized,
      wallNow: () => preflightNowMs,
    })).rejects.toThrow("bearer preflight failed");
    const mismatch = vi.fn(async () => ({
      status: 200, text: async () => validPayload().replace('"musicUserId":17', '"musicUserId":18'),
      body: { locked: false, cancel: vi.fn() },
    })) as unknown as typeof fetch;
    await expect(validateProvisionedBearer({
      proof: longLivedBearer, expectedMusicUserId: 17, fetchImpl: mismatch,
      wallNow: () => preflightNowMs,
    })).rejects.toThrow("bearer preflight failed");
  });

  it("rejects unsafe or near-expiry JWT lifetimes before the authority request", async () => {
    const { assertBearerLifetime, validateProvisionedBearer } = preflightLibrary();
    const sufficientlyLongLived = bearerWithExpiration(preflightNowMs / 1_000 + 2_401);
    expect(() => assertBearerLifetime(sufficientlyLongLived, preflightNowMs)).not.toThrow();
    for (const bearer of [
      bearerWithExpiration(preflightNowMs / 1_000 + 2_400),
      bearerWithExpiration(preflightNowMs / 1_000 - 1),
      bearerWithExpiration("1900003000"),
      bearerWithExpiration(Number.MAX_SAFE_INTEGER),
      `${"a".repeat(20)}.not-json.${"b".repeat(20)}`,
    ]) expect(() => assertBearerLifetime(bearer, preflightNowMs)).toThrow("bearer lifetime insufficient");

    const fetchImpl = vi.fn(async () => ({
      status: 200, text: async () => validPayload(), body: { locked: false, cancel: vi.fn() },
    })) as unknown as typeof fetch;
    await expect(validateProvisionedBearer({
      proof: bearerWithExpiration(preflightNowMs / 1_000 + 2_400),
      expectedMusicUserId: 17,
      fetchImpl,
      wallNow: () => preflightNowMs,
    })).rejects.toThrow("bearer preflight failed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("exports executable credential validation and SLO predicate helpers for contract tests", () => {
    const library = probeLibrary();
    expect(library.validateEnsurePayload).toBeTypeOf("function");
    expect(library.evaluateSlo).toBeTypeOf("function");
    expect(library.probeEnsure).toBeTypeOf("function");
  });

  it("accepts only a fully validated successful credential response", () => {
    const { validateEnsurePayload } = probeLibrary();
    expect(validateEnsurePayload(validPayload(), 1_900_000_000_000)).toEqual({
      token: credentialToken,
      expiresAt: 2_000_000_000_000,
    });
    for (const malformed of [
      "not-json",
      JSON.stringify({ credential: { token: credentialToken, expiresAt: 2_000_000_000_000 } }),
      validPayload(1_900_000_000_000),
      JSON.stringify({ version: "music-identity/v1", identity: { musicUserId: 17, status: "active" }, credential: { token: "", expiresAt: 2_000_000_000_000 } }),
      JSON.stringify({ version: "music-identity/v1", identity: { musicUserId: 17, status: "active" }, credential: { token: "not-a-jwt", expiresAt: 2_000_000_000_000 } }),
      JSON.stringify({ version: "music-identity/v1", identity: { musicUserId: 17, status: "active" }, credential: { token: credentialToken, expiresAt: 2_000_000_000_000 }, extra: true }),
    ]) expect(() => validateEnsurePayload(malformed, 1_900_000_000_000)).toThrow("credential response malformed");
  });

  it("includes complete body read and validation in latency and rejects malformed 200 responses", async () => {
    const { probeEnsure } = probeLibrary();
    let bodyRead = false;
    const valid = await probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: async () => { bodyRead = true; return validPayload(); },
        body: { locked: false, cancel: vi.fn() },
      })) as unknown as typeof fetch,
      monotonicNow: () => bodyRead ? 145 : 100,
      wallNow: () => 1_900_000_000_000,
    });
    expect(valid).toEqual({ success: true, latencyMs: 45, statusCategory: "success" });

    const malformed = await probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200, text: async () => "{}",
        body: { locked: false, cancel: vi.fn() },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
    });
    expect(malformed).toEqual({ success: false, latencyMs: 0, statusCategory: "transport_or_validation_error" });

    const unauthorized = await probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 401, text: async () => "not read",
        body: { locked: false, cancel: vi.fn() },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
    });
    expect(unauthorized).toEqual({ success: false, latencyMs: 0, statusCategory: "client_error" });
  });

  it("fails stalled reads and cannot preserve 200 success when read and cancellation fail", async () => {
    vi.useFakeTimers();
    const { probeEnsure } = probeLibrary();
    const stalled = probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: () => new Promise<string>(() => undefined),
        body: { locked: false, cancel: vi.fn(async () => { throw new Error("cancel failed"); }) },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(30);
    await expect(stalled).resolves.toEqual({
      success: false, latencyMs: 0, statusCategory: "transport_or_validation_error",
    });

    const rejected = probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: async () => { throw new Error("read failed"); },
        body: { locked: false, cancel: vi.fn(async () => { throw new Error("cancel failed"); }) },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
    });
    await expect(rejected).resolves.toEqual({
      success: false, latencyMs: 0, statusCategory: "transport_or_validation_error",
    });
  });

  it("settles a timed-out read even when response cancellation never settles", async () => {
    vi.useFakeTimers();
    const { probeEnsure } = probeLibrary();
    const stalled = probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: () => new Promise<string>(() => undefined),
        body: { locked: false, cancel: vi.fn(() => new Promise<void>(() => undefined)) },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
      timeoutMs: 25,
    });
    const bounded = Promise.race([
      stalled,
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 50)),
    ]);
    await vi.advanceTimersByTimeAsync(60);
    await expect(bounded).resolves.toEqual({
      success: false, latencyMs: 0, statusCategory: "transport_or_validation_error",
    });
  });

  it("requires 199 of 200 and gates cold, sequential warm, and concurrent p95 independently", () => {
    const { evaluateSlo } = probeLibrary();
    const passing = evaluateSlo({
      cold: [sample(4_900, false), ...Array.from({ length: 19 }, () => sample(100))],
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: Array.from({ length: 90 }, () => sample(950)),
    });
    expect(passing).toMatchObject({
      passed: true, sampleCount: 200, successCount: 199, successRatePercent: 99.5,
      gatewayProofCacheTtlColdP95Ms: 100, warmP95Ms: 900, concurrentP95Ms: 950,
      statusCategoryCounts: {
        success: 199, client_error: 0, server_error: 0, transport_or_validation_error: 1,
      },
    });

    const insufficientSuccess = evaluateSlo({
      cold: [sample(100, false), sample(100, false), ...Array.from({ length: 18 }, () => sample(100))],
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: Array.from({ length: 90 }, () => sample(950)),
    });
    expect(insufficientSuccess).toMatchObject({ passed: false, successCount: 198, successRatePercent: 99 });

    const authenticationFailure = evaluateSlo({
      cold: [sample(100, false, "client_error"), ...Array.from({ length: 19 }, () => sample(100))],
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: Array.from({ length: 90 }, () => sample(950)),
    });
    expect(authenticationFailure).toMatchObject({
      passed: false,
      successCount: 199,
      successRatePercent: 99.5,
      statusCategoryCounts: { client_error: 1 },
    });

    const slowConcurrent = evaluateSlo({
      cold: Array.from({ length: 20 }, () => sample(4_900)),
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: [
        ...Array.from({ length: 85 }, () => sample(950)),
        ...Array.from({ length: 5 }, () => sample(1_001)),
      ],
    });
    expect(slowConcurrent).toMatchObject({ passed: false, concurrentP95Ms: 1_001 });

    const observedAuthenticationFailure = evaluateSlo({
      cold: Array.from({ length: 20 }, () => sample(180, false, "client_error")),
      warm: Array.from({ length: 90 }, () => sample(180, false, "client_error")),
      concurrent: Array.from({ length: 90 }, () => sample(180, false, "client_error")),
    });
    expect(observedAuthenticationFailure).toMatchObject({
      passed: false,
      sampleCount: 200,
      successCount: 0,
      statusCategoryCounts: {
        success: 0, client_error: 200, server_error: 0, transport_or_validation_error: 0,
      },
    });
  });

  it("measures 20 TTL-cold cycles from prior-cycle completion within source and fingerprint limits", async () => {
    const { runQualification } = probeLibrary();
    let now = 0;
    let active = 0;
    let maxActive = 0;
    let sequence = 0;
    const calls: Array<{ at: number; sequence: number }> = [];
    const sleeps: Array<{ at: number; milliseconds: number }> = [];
    const qualification = await runQualification({
      proof: "one-real-user-bearer",
      cacheTtlMs: 30_000,
      probe: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        sequence += 1;
        calls.push({ at: now, sequence });
        await Promise.resolve();
        active -= 1;
        return { ...sample(100), sequence } as Sample;
      },
      sleepImpl: async (milliseconds) => {
        sleeps.push({ at: now, milliseconds });
        now += milliseconds;
      },
    });
    expect(qualification).toMatchObject({
      cold: { length: 20 }, warm: { length: 90 }, concurrent: { length: 90 },
    });
    expect(qualification.cold.map((entry) => (entry as Sample & { sequence: number }).sequence))
      .toEqual(Array.from({ length: 20 }, (_, index) => index * 10 + 1));
    expect(sleeps).toHaveLength(19);
    expect(sleeps.every((entry) => entry.milliseconds === 31_000)).toBe(true);
    expect(maxActive).toBe(5);
    for (let index = 1; index < qualification.cold.length; index += 1) {
      const previousCycleCompletion = sleeps[index - 1]!.at;
      const coldCall = calls[(index * 10)]!;
      expect(coldCall.at - previousCycleCompletion).toBe(31_000);
    }
    let bucketStart = calls[0]!.at;
    let bucketCount = 0;
    let maximumFixedWindowCount = 0;
    for (const call of calls) {
      if (call.at >= bucketStart + 60_000) {
        bucketStart = call.at;
        bucketCount = 0;
      }
      bucketCount += 1;
      maximumFixedWindowCount = Math.max(maximumFixedWindowCount, bucketCount);
    }
    expect(maximumFixedWindowCount).toBe(20);
    expect(maximumFixedWindowCount).toBeLessThanOrEqual(30);
  });

  it("attests the deployed cache and limiter contract and emits aggregate fields only", () => {
    const script = remoteScript();
    expect(script).toContain('test "$container_cache_ttl_ms" = 30000');
    expect(script).toContain('test "$container_identity_rate_limit" = 30');
    expect(script).toContain('const coldMode = "gateway_proof_cache_ttl_cold"');
    expect(script).toContain("restartCount: 1");
    expect(script).toContain('const ensureMutation = "identity_snapshots_and_sync_timestamps"');
    expect(script.match(/console\.log/g)).toHaveLength(1);
    for (const aggregate of [
      "sampleCount", "successCount", "successRatePercent", "gatewayProofCacheTtlColdP95Ms", "warmP95Ms",
      "concurrentP95Ms", "statusCategoryCounts",
    ]) expect(script).toContain(aggregate);
    for (const forbidden of [
      "requestId", "responseBody", "console.log(candidate", "console.log(provisioned", "console.log(response", "console.log(error",
    ]) expect(script).not.toContain(forbidden);
  });

  it("fails closed without logging raw errors or identity data", () => {
    const script = remoteScript();
    expect(script).toContain("failure_stage=probe_authority_attestation");
    expect(script).toContain('reason: "probe_failed_closed"');
    expect(script).toContain("process.exitCode = 1");
    expect(script).not.toMatch(/console\.(?:error|warn|debug|info)/);
    expect(script).not.toMatch(/JSON\.stringify\((?:candidate|users|response|error|cause|proof)/);
    expect(preflightNodeSource()).not.toContain("console.");
  });
});
