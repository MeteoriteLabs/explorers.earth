import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer, request as httpRequest, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const yaml = require("js-yaml") as { load(source: string): any; dump(value: unknown): string };
const enabled = process.env.MUSIC_C3_TRAEFIK_TEST === "1";
const describeTraefik = enabled ? describe.sequential : describe.skip;
const repoRoot = resolve(import.meta.dirname, "../../../..");
const compatEntrypoint = resolve(repoRoot, "tunes/server/deployment/run-registration-compat.ts");

function listen(server: Server): Promise<number> {
  return new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => {
      const address = server.address();
      if (!address || typeof address === "string") reject(new Error("listener has no TCP address"));
      else resolvePort(address.port);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

function post(port: number, path: string, body: string, forwardedFor?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolveResponse, reject) => {
    const request = httpRequest({
      hostname: "127.0.0.1", port, path, method: "POST",
      headers: {
        host: "localtunes.earth",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      },
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => resolveResponse({ status: response.statusCode ?? 0, body: responseBody }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

describeTraefik("production registration compatibility route through Traefik", () => {
  let sandbox: string;
  const containerName = `music-register-traefik-${process.pid}-${Date.now()}`;
  let compat: ChildProcess;
  let general: Server;
  let candidate: Server;
  let traefikPort: number;
  let generalCalls = 0;

  beforeAll(async () => {
    sandbox = mkdtempSync(join(tmpdir(), "music-register-traefik-"));
    general = createServer((_request, response) => {
      generalCalls += 1;
      response.writeHead(418, { "content-type": "text/plain", "content-length": "12" });
      response.end("C2_FALLBACK!", "utf8");
    });
    const generalPort = await listen(general);
    candidate = createServer((_request, response) => response.end("private-candidate"));
    await listen(candidate);

    compat = spawn(process.execPath, ["--import", "tsx", compatEntrypoint], {
      cwd: repoRoot,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PORT: "0",
        MUSIC_COMPAT_HOST: "0.0.0.0",
        MUSIC_COMPAT_REPORT_ADDRESS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const compatPort = await new Promise<number>((resolvePort, reject) => {
      let stderr = "";
      const timer = setTimeout(() => reject(new Error(`compat listener timeout: ${stderr}`)), 5_000);
      compat.stderr?.setEncoding("utf8");
      compat.stderr?.on("data", (chunk) => { stderr += chunk; });
      compat.once("exit", (code) => reject(new Error(`compat listener exited ${code}: ${stderr}`)));
      compat.stdout?.setEncoding("utf8");
      compat.stdout?.once("data", (chunk: string) => {
        clearTimeout(timer);
        resolvePort((JSON.parse(chunk.trim()) as { port: number }).port);
      });
    });

    const deploySource = readFileSync(resolve(repoRoot, "tunes/deployment/music-deploy-engine.sh"), "utf8");
    const heredocStart = deploySource.indexOf('    cat > "$temporary" <<EOF');
    const heredocEnd = deploySource.indexOf("\nEOF", heredocStart);
    if (heredocStart < 0 || heredocEnd < 0) throw new Error("production compatibility route template missing");
    const template = deploySource.slice(deploySource.indexOf("\n", heredocStart) + 1, heredocEnd)
      .replaceAll("\\`", "`")
      .replace("http://tunes-register-compat:5100", `http://host.docker.internal:${compatPort}`)
      .replace("http://${service}:5000", `http://host.docker.internal:${generalPort}`);
    const dynamic = yaml.load(template);
    for (const router of Object.values(dynamic.http.routers) as any[]) {
      router.entryPoints = ["web"];
      delete router.tls;
    }
    const dynamicFile = join(sandbox, "music-router.yml");
    writeFileSync(dynamicFile, yaml.dump(dynamic));

    const started = spawnSync("docker", [
      "run", "-d", "--rm", "--name", containerName,
      "--label", "com.explorers.music.fixture=true",
      "--label", "com.explorers.music.project=explorers-music-traefik-route",
      "--add-host", "host.docker.internal:host-gateway",
      "-p", "127.0.0.1::8080",
      "--mount", `type=bind,src=${dynamicFile},dst=/etc/traefik/dynamic.yml,readonly`,
      "traefik:v3.1",
      "--providers.file.filename=/etc/traefik/dynamic.yml",
      "--entrypoints.web.address=:8080",
      "--log.level=ERROR",
    ], { encoding: "utf8" });
    if (started.status !== 0) throw new Error(`Traefik start failed: ${started.stderr}`);
    const mapping = spawnSync("docker", ["port", containerName, "8080/tcp"], { encoding: "utf8" });
    const match = mapping.stdout.match(/:(\d+)\s*$/);
    if (!match) throw new Error(`Traefik port mapping missing: ${mapping.stdout} ${mapping.stderr}`);
    traefikPort = Number(match[1]);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        const response = await post(traefikPort, "/not-registration", "{}");
        if (response.status === 418) return;
      } catch { /* startup retry */ }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }
    throw new Error("Traefik route did not become ready");
  }, 30_000);

  afterAll(async () => {
    spawnSync("docker", ["stop", "--time", "1", containerName], { encoding: "utf8" });
    compat?.kill();
    if (candidate?.listening) await close(candidate);
    if (general?.listening) await close(general);
    if (sandbox) rmSync(sandbox, { recursive: true, force: true });
  });

  it("denies every Express alias before the gate and after a private candidate readiness failure", async () => {
    const aliases = ["/api/register", "/api/register/?source=legacy", "/API/REGISTER?source=legacy", "/aPi/ReGiStEr/"];
    const forged = JSON.stringify({ strapiUserDocumentId: "DO_NOT_INSERT", strapiAccountDocumentId: "DO_NOT_INSERT" });
    for (const phase of ["before-gate", "after-readiness-failure"]) {
      if (phase === "after-readiness-failure") await close(candidate);
      for (const path of aliases) {
        for (const body of ["{}", forged]) {
          const response = await post(traefikPort, path, body);
          expect(response.status, `${phase} ${path}`).toBe(410);
          expect(JSON.parse(response.body).error.code).toBe("LEGACY_IDENTITY_ROUTE_REMOVED");
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 275));
        }
      }
      expect(generalCalls, phase).toBe(1);
    }
    for (const path of ["/api/register//", "/api/register/extra"]) {
      expect((await post(traefikPort, path, "{}")).status).toBe(418);
    }
    expect(generalCalls).toBe(3);
  }, 20_000);

  it("rate limits one remote peer despite forged forwarding headers and recovers", async () => {
    // Production omits sourceCriterion, so Traefik keys this limiter by the
    // direct peer. Distinct untrusted XFF values must remain one source bucket;
    // the refill wait deliberately exceeds the configured one-second period.
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_250));
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      post(traefikPort, "/api/register", "{}", `203.0.113.${index + 1}`)));
    expect(responses.some(({ status }) => status === 410)).toBe(true);
    expect(responses.some(({ status }) => status === 429)).toBe(true);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_250));
    expect((await post(traefikPort, "/API/REGISTER/", "{}", "198.51.100.200")).status).toBe(410);
  }, 10_000);
});
