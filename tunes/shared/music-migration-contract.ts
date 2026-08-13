export const EXPECTED_MUSIC_MIGRATION_ID = "0005_resource_bound_deletion_history" as const;
export const EXPECTED_MUSIC_MIGRATION_CHAIN = [
  "0001_runtime_baseline",
  "0002_identity_lifecycle",
  "0003_identity_lifecycle_hardening",
  "0004_identity_delete_saga",
  EXPECTED_MUSIC_MIGRATION_ID,
] as const;
export const LEGACY_CONTAINMENT_MIGRATION_MARKER = "containment-no-schema-change" as const;
