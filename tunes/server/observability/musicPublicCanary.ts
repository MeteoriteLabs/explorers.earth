export interface MusicPublicCanaryMeasurements {
  descriptorP95Ms: number;
  resourceP95Ms: number;
  fiveXxRate: number;
  listenerDisconnectSeconds: number;
  notificationFanoutP95Ms: number;
  fallbackPollingRate: number;
  authorizationLeaks: number;
  crossOwnerEvents: number;
  capabilityExposures: number;
}

type Gate = "authorization_leak" | "cross_owner_event" | "capability_exposure" | "descriptor_latency" | "resource_latency" | "server_error_rate" | "listener_disconnect" | "fanout_latency" | "fallback_polling";

export function evaluateMusicPublicCanary(value: MusicPublicCanaryMeasurements): { action: "promote" | "contain" | "rollback"; failedGates: Gate[] } {
  const immediate: Gate[] = [];
  if (value.authorizationLeaks > 0) immediate.push("authorization_leak");
  if (value.crossOwnerEvents > 0) immediate.push("cross_owner_event");
  if (value.capabilityExposures > 0) immediate.push("capability_exposure");
  if (immediate.length) return { action: "rollback", failedGates: immediate };
  const failed: Gate[] = [];
  if (value.descriptorP95Ms >= 500) failed.push("descriptor_latency");
  if (value.resourceP95Ms >= 500) failed.push("resource_latency");
  if (value.fiveXxRate >= 0.02) failed.push("server_error_rate");
  if (value.listenerDisconnectSeconds >= 30) failed.push("listener_disconnect");
  if (value.notificationFanoutP95Ms >= 2_000) failed.push("fanout_latency");
  if (value.fallbackPollingRate >= 0.1) failed.push("fallback_polling");
  return failed.length ? { action: "contain", failedGates: failed } : { action: "promote", failedGates: [] };
}
