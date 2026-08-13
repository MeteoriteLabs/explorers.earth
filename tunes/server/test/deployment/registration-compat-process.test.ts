import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const entrypoint = resolve(import.meta.dirname, "../../deployment/run-registration-compat.ts");

describe("registration compatibility process", () => {
  let child: ChildProcess | undefined;

  afterEach(() => {
    child?.kill();
    child = undefined;
  });

  async function start(): Promise<string> {
    child = spawn(process.execPath, ["--import", "tsx", entrypoint], {
      cwd: resolve(import.meta.dirname, "../../.."),
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PORT: "0",
        MUSIC_COMPAT_HOST: "127.0.0.1",
        MUSIC_COMPAT_REPORT_ADDRESS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    return new Promise((resolveUrl, reject) => {
      const timer = setTimeout(() => reject(new Error(`compat process did not listen: ${stderr}`)), 5_000);
      child?.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`compat process exited ${code}: ${stderr}`));
      });
      child?.stdout?.setEncoding("utf8");
      child?.stdout?.once("data", (chunk: string) => {
        clearTimeout(timer);
        const { port } = JSON.parse(chunk.trim()) as { port: number };
        resolveUrl(`http://127.0.0.1:${port}`);
      });
    });
  }

  async function rawRequest(port: number, chunks: Array<{ bytes: string; delayMs?: number }>): Promise<string> {
    return new Promise((resolveResponse, reject) => {
      const socket = connect(port, "127.0.0.1");
      let response = "";
      const timeout = setTimeout(() => { socket.destroy(); reject(new Error("raw request timed out")); }, 5_000);
      socket.setEncoding("utf8");
      socket.on("data", (data) => { response += data; });
      socket.on("error", reject);
      socket.on("close", () => { clearTimeout(timeout); resolveResponse(response); });
      socket.on("connect", async () => {
        for (const chunk of chunks) {
          if (chunk.delayMs) await new Promise((resolveDelay) => setTimeout(resolveDelay, chunk.delayMs));
          if (!socket.destroyed) socket.write(chunk.bytes);
        }
      });
    });
  }

  it("serves only the DB-free typed registration denial without reflecting input", async () => {
    const baseUrl = await start();
    const sentinel = "FORGED_SERVER_OWNED_IDENTITY_DO_NOT_REFLECT";
    for (const path of ["/api/register", "/api/register/", "/API/REGISTER", "/aPi/ReGiStEr/?source=legacy"]) {
      for (const body of ["{}", JSON.stringify({
        strapiUserDocumentId: sentinel,
        strapiAccountDocumentId: sentinel,
        lifecycleOperationId: sentinel,
        guestCapabilityHash: sentinel,
      })]) {
        const response = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        const responseBody = await response.text();
        const parsed = JSON.parse(responseBody);
        expect(response.status).toBe(410);
        expect(response.headers.get("x-request-id")).toBe(parsed.error.requestId);
        expect(Number(response.headers.get("content-length"))).toBe(Buffer.byteLength(responseBody));
        expect(parsed.error).toMatchObject({
          code: "LEGACY_IDENTITY_ROUTE_REMOVED",
          action: "upgrade_client",
          retryable: false,
        });
        expect(responseBody.length).toBeLessThan(512);
        expect(responseBody).not.toContain(sentinel);
      }
    }
    await expect(fetch(`${baseUrl}/api/register`)).resolves.toMatchObject({ status: 404 });
    await expect(fetch(`${baseUrl}/api/register//`, { method: "POST", body: "{}" })).resolves.toMatchObject({ status: 404 });
    await expect(fetch(`${baseUrl}/api/register/extra`, { method: "POST", body: "{}" })).resolves.toMatchObject({ status: 404 });
    await expect(fetch(`${baseUrl}/not-registration`, { method: "POST", body: "{}" })).resolves.toMatchObject({ status: 404 });
    await expect(fetch(`${baseUrl}/health/live`)).resolves.toMatchObject({ status: 200 });
  }, 10_000);

  it("rejects declared and chunked oversized bodies and closes slow requests", async () => {
    const baseUrl = await start();
    const port = Number(new URL(baseUrl).port);
    const declared = await rawRequest(port, [{ bytes: [
      "POST /api/register HTTP/1.1", "Host: localtunes.earth", "Content-Length: 9000", "Connection: close", "", "",
    ].join("\r\n") }]);
    expect(declared).toMatch(/^HTTP\/1\.1 413 /);
    expect(declared).toContain('"code":"PAYLOAD_TOO_LARGE"');
    expect(declared).not.toContain("9000");

    const chunked = await rawRequest(port, [{ bytes: [
      "POST /API/REGISTER/ HTTP/1.1", "Host: localtunes.earth", "Transfer-Encoding: chunked", "Connection: close", "",
      "2329", "x".repeat(9001), "0", "", "",
    ].join("\r\n") }]);
    expect(chunked).toMatch(/^HTTP\/1\.1 413 /);
    expect(chunked).toContain('"code":"PAYLOAD_TOO_LARGE"');

    const slow = await rawRequest(port, [
      { bytes: ["POST /api/register HTTP/1.1", "Host: localtunes.earth", "Content-Length: 2", "Connection: close", "", "{"].join("\r\n") },
      { delayMs: 2_500, bytes: "}" },
    ]);
    expect(slow).not.toContain("LEGACY_IDENTITY_ROUTE_REMOVED");
    expect(slow).toMatch(/^HTTP\/1\.1 408 |^$/);
  }, 15_000);
});
