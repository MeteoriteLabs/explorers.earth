import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface RuntimeTableManifestInput {
  manifestTables: string[];
  referencedTables: string[];
  migratedTables: string[];
  unmanagedTables?: string[];
}

export interface RuntimeTableInventory {
  drizzleTables: string[];
  rawSqlTables: string[];
  applicationTables: string[];
  systemTables: string[];
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (name === "node_modules" || name === "dist" || name === ".artifacts") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx|js|mjs|sql)$/.test(name) ? [path] : [];
  });
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function inventoryRuntimeTables(repositoryRoot: string): RuntimeTableInventory {
  const schema = readFileSync(join(repositoryRoot, "tunes", "shared", "schema.ts"), "utf8");
  const drizzleTables = sorted([...schema.matchAll(/pgTable\(\s*["']([a-z_][a-z0-9_]*)["']/g)].map((match) => match[1]));
  const rawSqlTables = new Set<string>();
  for (const file of sourceFiles(join(repositoryRoot, "tunes", "server"))) {
    const source = readFileSync(file, "utf8");
    const statements = [
      ...[...source.matchAll(/(?:\.query\s*\(|sql)\s*`([\s\S]*?)`/g)].map((match) => match[1]),
      ...[...source.matchAll(/\.query\s*\(\s*'((?:\\.|[^'])*)'/g)].map((match) => match[1]),
      ...[...source.matchAll(/\.query\s*\(\s*"((?:\\.|[^"])*)"/g)].map((match) => match[1]),
    ];
    for (const statement of statements) for (const match of statement.matchAll(/\b(?:DELETE\s+FROM|FROM|JOIN|UPDATE|INTO)\s+["']?([a-z_][a-z0-9_]*)["']?/gi)) rawSqlTables.add(match[1].toLowerCase());
  }
  const systemTables = sorted([...rawSqlTables].filter((table) => table.startsWith("pg_") || table.startsWith("information_schema")));
  const applicationRawSqlTables = sorted([...rawSqlTables].filter((table) => !systemTables.includes(table)));
  return {
    drizzleTables,
    rawSqlTables: applicationRawSqlTables,
    applicationTables: sorted([...drizzleTables, ...applicationRawSqlTables]),
    systemTables,
  };
}

export function validateRuntimeTableManifest(input: RuntimeTableManifestInput): void {
  const unmanaged = new Set(input.unmanagedTables ?? []);
  for (const table of input.referencedTables) if (!input.manifestTables.includes(table)) throw new Error(`${table} is referenced at runtime but missing from the manifest`);
  for (const table of input.manifestTables) if (!input.migratedTables.includes(table) && !unmanaged.has(table)) throw new Error(`${table} is in the manifest but absent from a fresh migrated database`);
  for (const table of unmanaged) if (!input.referencedTables.includes(table)) throw new Error(`${table} is marked unmanaged but has no runtime reference`);
}
