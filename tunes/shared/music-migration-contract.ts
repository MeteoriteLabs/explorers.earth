export const EXPECTED_MUSIC_MIGRATION_ID = "0004_identity_delete_saga" as const;
export const EXPECTED_MUSIC_MIGRATION_CHAIN = [
  "0001_runtime_baseline",
  "0002_identity_lifecycle",
  "0003_identity_lifecycle_hardening",
  EXPECTED_MUSIC_MIGRATION_ID,
] as const;
export const LEGACY_CONTAINMENT_MIGRATION_MARKER = "containment-no-schema-change" as const;
