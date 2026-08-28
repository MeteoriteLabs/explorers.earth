import { describe, expect, it } from "vitest";
import { evaluateMusicPublicCanary } from "../observability/musicPublicCanary";

describe("public Music canary gates", () => {
  it("passes the calibrated baseline and exposes bounded operator-safe reasons", () => {
    expect(evaluateMusicPublicCanary({ descriptorP95Ms: 499, resourceP95Ms: 499, fiveXxRate: 0.019,
      listenerDisconnectSeconds: 29, notificationFanoutP95Ms: 1_999, fallbackPollingRate: 0.099,
      authorizationLeaks: 0, crossOwnerEvents: 0, capabilityExposures: 0 })).toEqual({ action: "promote", failedGates: [] });
  });

  it("rolls back immediately for authority exposure and contains ordinary threshold failures", () => {
    expect(evaluateMusicPublicCanary({ descriptorP95Ms: 200, resourceP95Ms: 200, fiveXxRate: 0,
      listenerDisconnectSeconds: 0, notificationFanoutP95Ms: 100, fallbackPollingRate: 0,
      authorizationLeaks: 1, crossOwnerEvents: 0, capabilityExposures: 0 })).toEqual({ action: "rollback", failedGates: ["authorization_leak"] });
    expect(evaluateMusicPublicCanary({ descriptorP95Ms: 500, resourceP95Ms: 501, fiveXxRate: 0.02,
      listenerDisconnectSeconds: 30, notificationFanoutP95Ms: 2_000, fallbackPollingRate: 0.1,
      authorizationLeaks: 0, crossOwnerEvents: 0, capabilityExposures: 0 })).toEqual({
        action: "contain", failedGates: ["descriptor_latency", "resource_latency", "server_error_rate", "listener_disconnect", "fanout_latency", "fallback_polling"],
      });
  });
});
