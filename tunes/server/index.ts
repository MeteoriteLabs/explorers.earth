import { startMusicServer } from "./config/music-startup";

function installCrashHandlers(): void {
  process.on("uncaughtException", (error) => {
    console.error("[uncaughtException] Server encountered a fatal error:", error);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection] Server encountered a fatal promise rejection:", reason);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const dotenv = await import("dotenv");
  dotenv.default.config();
  const { app } = await startMusicServer(process.env);
  installCrashHandlers();
  console.log(`Server listening on http://0.0.0.0:${process.env.PORT || "5000"}`);
  console.log(`Environment: ${app.get("env")}`);
}

if (process.env.NODE_ENV !== "test") {
  void main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}
