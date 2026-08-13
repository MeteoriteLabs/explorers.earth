import dotenv from "dotenv";
import { parseMusicEnvironment } from "./config/music-environment";

// Load environment variables from .env file
dotenv.config();

// When the Music identity controls are enabled, startup and the CLI use the
// same typed, fail-closed environment contract. Existing deployments that do
// not opt into MUSIC_MODE remain untouched during C0.
if (process.env.MUSIC_MODE) parseMusicEnvironment(process.env);

// ─── Global crash safety nets ────────────────────────────────────────────────
// Log and exit on uncaught exceptions/rejections so the process manager (Docker) can restart the server cleanly
process.on('uncaughtException', (err) => {
  console.error('💥 [uncaughtException] Server encountered a fatal error:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 [unhandledRejection] Server encountered a fatal promise rejection:', reason);
  process.exit(1);
});

// Log environment variables for debugging
console.log('Environment variables loaded:');
console.log('BASE_URL:', process.env.BASE_URL);

import { createApp } from "./app";
import { setupVite, serveStatic } from "./vite";

// Start the HTTP server only when run as the entrypoint — NOT under test.
// Tests import { createApp } from "./app" directly and never bind a port.
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const { app, server } = await createApp();

      if (app.get("env") === "development") {
        console.log('Setting up Vite in development mode...');
        await setupVite(app, server);
      } else {
        console.log('Setting up static serving in production mode...');
        serveStatic(app);
      }

      // Get port from environment variables
      // In Render and Docker, apps MUST listen on 0.0.0.0
      // We hardcode 0.0.0.0 to prevent accidental HOST=localhost values from breaking deployments
      const port = parseInt(process.env.PORT || '5000', 10);
      const host = '0.0.0.0';

      server.listen(port, host, () => {
        console.log(`\n=== Server Started ===`);
        console.log(`Server listening on http://${host}:${port}`);
        console.log(`Environment: ${app.get("env")}`);
        console.log(`===================\n`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  })();
}
