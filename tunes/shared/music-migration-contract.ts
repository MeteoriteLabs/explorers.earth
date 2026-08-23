export const EXPECTED_MUSIC_MIGRATION_ID = "0017_publication_idempotency_key_retirement" as const;
export const EXPECTED_MUSIC_MIGRATION_CHAIN = [
  "0001_runtime_baseline",
  "0002_identity_lifecycle",
  "0003_identity_lifecycle_hardening",
  "0004_identity_delete_saga",
  "0005_resource_bound_deletion_history",
  "0006_numeric_identity_lock",
  "0007_identity_provider_snapshot",
  "0008_credential_revocation_operations",
  "0009_credential_revocation_history_immutability",
  "0010_least_privilege_runtime_role",
  "0011_durable_publication_idempotency",
  "0012_publication_replay_expiry_guard",
  "0013_publication_operation_database_clock",
  "0014_durable_reactivation_authority",
  "0015_publication_operation_archive",
  "0016_publication_operation_retention",
  EXPECTED_MUSIC_MIGRATION_ID,
] as const;
export const LEGACY_CONTAINMENT_MIGRATION_MARKER = "containment-no-schema-change" as const;

export const DEPLOYABLE_MUSIC_MIGRATION_MARKERS = [
  LEGACY_CONTAINMENT_MIGRATION_MARKER,
  "0002_identity_lifecycle",
  "0003_identity_lifecycle_hardening",
  "0004_identity_delete_saga",
  "0005_resource_bound_deletion_history",
  "0006_numeric_identity_lock",
  "0007_identity_provider_snapshot",
  "0008_credential_revocation_operations",
  "0009_credential_revocation_history_immutability",
  "0010_least_privilege_runtime_role",
  "0011_durable_publication_idempotency",
  "0012_publication_replay_expiry_guard",
  "0013_publication_operation_database_clock",
  "0014_durable_reactivation_authority",
  "0015_publication_operation_archive",
  "0016_publication_operation_retention",
  EXPECTED_MUSIC_MIGRATION_ID,
] as const;

export type DeployableMusicMigrationMarker = typeof DEPLOYABLE_MUSIC_MIGRATION_MARKERS[number];

export function musicMigrationMarkerRank(marker: string): number | undefined {
  const rank = DEPLOYABLE_MUSIC_MIGRATION_MARKERS.indexOf(marker as DeployableMusicMigrationMarker);
  return rank < 0 ? undefined : rank;
}
