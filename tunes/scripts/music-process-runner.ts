import { spawn, type ChildProcess } from "node:child_process";

export interface ChildResult { exitCode: number; stdout: string; stderr: string; }

export class OwnedProcessRunner {
  private readonly children = new Set<ChildProcess>();

  async run(file: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv } ): Promise<ChildResult> {
    return await new Promise((resolve, reject) => {
      const child = spawn(file, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      });
      this.children.add(child);
      let stdout = "";
      let stderr = "";
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => { stdout += chunk; });
      child.stderr?.on("data", (chunk) => { stderr += chunk; });
      child.once("error", (error) => { this.children.delete(child); reject(error); });
      child.once("close", (code) => { this.children.delete(child); resolve({ exitCode: code ?? 1, stdout, stderr }); });
    });
  }

  async terminateAll(): Promise<void> {
    const children = [...this.children];
    await Promise.all(children.map(async (child) => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        await new Promise<void>((resolve) => {
          const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
          killer.once("close", () => resolve());
          killer.once("error", () => resolve());
        });
      } else {
        try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
      }
    }));
  }
}
