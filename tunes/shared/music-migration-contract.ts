export const EXPECTED_MUSIC_MIGRATION_ID = "0003_identity_lifecycle_hardening" as const;
export const EXPECTED_MUSIC_MIGRATION_CHAIN = [
  "0001_runtime_baseline",
  "0002_identity_lifecycle",
  EXPECTED_MUSIC_MIGRATION_ID,
] as const;
export const LEGACY_CONTAINMENT_MIGRATION_MARKER = "containment-no-schema-change" as const;
