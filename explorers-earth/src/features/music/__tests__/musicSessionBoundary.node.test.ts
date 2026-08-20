import { describe, expect, it, vi } from "vitest";

describe("server-side Music session boundary composition", () => {
  it("uses a transportless no-op boundary without a browser realm", async () => {
    const browserWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, "window");
    vi.resetModules();
    try {
      const module = await import("../musicSessionBoundary");
      expect(() => {
        module.musicSessionBoundary.publish("account-generation");
        module.musicSessionBoundary.close();
      }).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: browserWindow });
    }
  });
});
