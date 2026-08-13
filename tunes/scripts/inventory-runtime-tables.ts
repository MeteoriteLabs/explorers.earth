export interface RuntimeTableManifestInput { manifestTables: string[]; referencedTables: string[]; migratedTables: string[]; }
export function validateRuntimeTableManifest(input: RuntimeTableManifestInput): void {
  for (const table of input.referencedTables) if (!input.manifestTables.includes(table)) throw new Error(`${table} is referenced at runtime but missing from the manifest`);
  for (const table of input.manifestTables) if (!input.migratedTables.includes(table)) throw new Error(`${table} is in the manifest but absent from a fresh migrated database`);
}
