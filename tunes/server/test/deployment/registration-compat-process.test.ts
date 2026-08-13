import { spawn, type ChildProcess } from "node:child_process";
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

  it("serves only the DB-free typed registration denial without reflecting input", async () => {
    const baseUrl = await start();
    const sentinel = "FORGED_SERVER_OWNED_IDENTITY_DO_NOT_REFLECT";
    for (const body of ["{}", JSON.stringify({
      strapiUserDocumentId: sentinel,
      strapiAccountDocumentId: sentinel,
      lifecycleOperationId: sentinel,
      guestCapabilityHash: sentinel,
    })]) {
      const response = await fetch(`${baseUrl}/api/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const responseBody = await response.text();
      const parsed = JSON.parse(responseBody);
      expect(response.status).toBe(410);
      expect(response.headers.get("x-request-id")).toBe(parsed.error.requestId);
      expect(parsed.error).toMatchObject({
        code: "LEGACY_IDENTITY_ROUTE_REMOVED",
        action: "upgrade_client",
        retryable: false,
      });
      expect(responseBody.length).toBeLessThan(512);
      expect(responseBody).not.toContain(sentinel);
    }
    await expect(fetch(`${baseUrl}/api/register`)).resolves.toMatchObject({ status: 404 });
    await expect(fetch(`${baseUrl}/not-registration`, { method: "POST", body: "{}" })).resolves.toMatchObject({ status: 404 });
    await expect(fetch(`${baseUrl}/health/live`)).resolves.toMatchObject({ status: 200 });
  }, 10_000);
});
