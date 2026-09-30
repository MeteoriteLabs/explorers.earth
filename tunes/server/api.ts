import { startMusicServer } from "./config/music-startup";

async function main(): Promise<void> {
  process.env.NODE_ENV ??= "production";
  const dotenv = await import("dotenv");
  dotenv.default.config();
  const { server, shutdown } = await startMusicServer(process.env, { apiOnly: true });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
    void shutdown().then(() => { process.exitCode = 0; }, (error) => {
      console.error("API shutdown failed:", error);
      process.exitCode = 1;
    });
  });
  console.log(`API listening on ${JSON.stringify(server.address())}`);
}

if (process.env.NODE_ENV !== "test") void main().catch((error) => {
  console.error("Failed to start API:", error);
  process.exitCode = 1;
});
