import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { posix, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { musicErrorCodeSchema } from "../../../shared/musicError";
import { EXPECTED_MUSIC_MIGRATION_CHAIN } from "../../../shared/music-migration-contract";
import { MUSIC_OPENAPI_DOCUMENT } from "../../routes/musicOpenApiRoutes";

const root = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

const requiredDocuments = [
  "docs/architecture/music-identity.md",
  "docs/api/music-identity-contract.md",
  "docs/security/music-auth-model.md",
  "docs/testing/music-identity-testing.md",
  "docs/operations/music-deploy-runbook.md",
  "docs/operations/music-reconciliation-runbook.md",
  "docs/operations/music-incident-runbook.md",
] as const;

const publicCommands = [
  "music:bootstrap", "music:doctor", "music:up", "music:test:smoke", "music:test:all",
  "music:test:fast", "music:test:pr", "music:test:nightly", "music:down", "music:db:status",
  "music:db:migrate", "music:db:verify", "music:db:reset", "music:fixtures:capture",
  "music:reconcile", "music:types:scoped", "music:types:baseline",
] as const;

type StaleGuidanceCode = "node-18" | "db-push" | "x-username-ownership";
type StaleGuidanceFinding = { path: string; line: number; code: StaleGuidanceCode };

function indexedMarkdownDocuments(indexSource = read("docs/README.md")): string[] {
  const paths = new Set(["docs/README.md"]);
  const pending = ["docs/README.md"];
  const supplied = new Map([["docs/README.md", indexSource]]);

  while (pending.length > 0) {
    const path = pending.shift()!;
    const source = supplied.get(path) ?? read(path);
    for (const [, rawTarget] of source.matchAll(/\]\(([^)#?]+\.md)(?:#[^)]*)?\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(rawTarget)) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), rawTarget.replaceAll("\\", "/")));
      if (target === ".." || target.startsWith("../") || paths.has(target)) continue;
      paths.add(target);
      if (existsSync(resolve(root, target))) pending.push(target);
    }
  }

  return [...paths].sort();
}

function staleGuidanceFindings(sources: Record<string, string>): StaleGuidanceFinding[] {
  const findings: StaleGuidanceFinding[] = [];
  for (const [path, source] of Object.entries(sources)) {
    source.split(/\r?\n/).forEach((line, index) => {
      if (/\bNode(?:\.js)?\s+18(?:\.\d+)?\+?/i.test(line)) {
        findings.push({ path, line: index + 1, code: "node-18" });
      }
      if (/\bnpm\s+run\s+db:push\b/i.test(line)) {
        findings.push({ path, line: index + 1, code: "db-push" });
      }
      if (/\bX-Username\b/i.test(line)
          && !/(?:^|\b)(?:no authorization|not owner authority|never|forbidden|prohibited|removed|retired|rejected)(?:\b|$)/i.test(line)) {
        findings.push({ path, line: index + 1, code: "x-username-ownership" });
      }
    });
  }
  return findings;
}

type DocumentationCatalog = {
  schemaVersion?: string;
  documents?: string[];
  commands?: string[];
  migrationChain?: string[];
  nonHttpErrorCodes?: string[];
  authorities?: Record<string, string>;
  runtimeFacts?: Record<string, string>;
};

function catalog(): DocumentationCatalog {
  const path = resolve(root, "docs/architecture/music-documentation-contract.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as DocumentationCatalog : {};
}

function documentedHttpErrorCodes(): string[] {
  const codes = new Set<string>();
  for (const pathItem of Object.values(MUSIC_OPENAPI_DOCUMENT.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== "object" || !("responses" in operation)) continue;
      for (const response of Object.values(operation.responses as Record<string, Record<string, unknown>>)) {
        for (const code of (response["x-error-codes"] as string[] | undefined) ?? []) codes.add(code);
      }
    }
  }
  return [...codes];
}

describe("Music documentation publication contract", () => {
  it("publishes every identity, API, security, testing, deployment, reconciliation, and incident document", () => {
    // Break caught: an operator or integrator loses the only supported contract for a release-critical surface.
    expect(requiredDocuments.filter((path) => !existsSync(resolve(root, path)))).toEqual([]);
  });

  it("binds published commands and migrations to executable repository authorities", () => {
    // Break caught: a runbook keeps advertising a removed command or migration epoch.
    const contract = catalog();
    const rootPackage = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(contract.schemaVersion).toBe("music-documentation-contract/v1");
    expect(contract.documents).toEqual([...requiredDocuments]);
    expect(contract.commands).toEqual([...publicCommands]);
    expect(contract.commands?.filter((command) => !rootPackage.scripts[command])).toEqual([]);
    expect(contract.migrationChain).toEqual([...EXPECTED_MUSIC_MIGRATION_CHAIN]);
    for (const migration of contract.migrationChain ?? []) {
      expect(existsSync(resolve(root, `tunes/migrations/${migration}.${"sql"}`)), migration).toBe(true);
    }
  });

  it("makes every stable error code discoverable from HTTP or an explicit non-HTTP authority", () => {
    // Break caught: a caller receives a stable code with no published recovery contract.
    const documented = new Set([...documentedHttpErrorCodes(), ...(catalog().nonHttpErrorCodes ?? [])]);
    expect([...documented].sort()).toEqual([...musicErrorCodeSchema.options].sort());
  });

  it("names the live machine-readable authorities and actual runtime/type debt", () => {
    const contract = catalog();
    expect(contract.authorities).toEqual({
      routes: "docs/architecture/music-runtime-surface-inventory.json",
      api: "GET /api-docs",
      errors: "tunes/shared/musicError.ts",
      environment: ".env.music.example + .env.music.test.example",
      migrations: "tunes/shared/music-migration-contract.ts",
      tables: "fixtures/db/music-runtime-table-manifest.json",
    });
    expect(contract.runtimeFacts).toEqual({
      node: ">=22.12",
      react: "18.3",
      expressRuntime: "5.2",
      expressTypes: "4.17 (known debt)",
    });
  });

  it("detects stale setup and ownership guidance in a hostile Markdown fixture", () => {
    // Break caught: the policy scanner accidentally stops recognizing one of the retired guidance forms.
    expect(staleGuidanceFindings({
      "docs/hostile.md": [
        "Use Node.js 18+.",
        "Run npm run db:push to synchronize production.",
        "Send X-Username to establish the playlist owner.",
      ].join("\n"),
    })).toEqual([
      { path: "docs/hostile.md", line: 1, code: "node-18" },
      { path: "docs/hostile.md", line: 2, code: "db-push" },
      { path: "docs/hostile.md", line: 3, code: "x-username-ownership" },
    ]);
  });

  it("keeps every published or indexed Markdown document free of retired guidance", () => {
    // Break caught: an indexed guide or agent context revives Node 18, db:push, or caller-owned usernames.
    const paths = indexedMarkdownDocuments();
    expect(paths).toEqual(expect.arrayContaining([
      "CLAUDE.md",
      "tunes/CLAUDE.md",
      "docs/getting-started.md",
      "docs/testing/music-release-evidence-template.md",
      "docs/tunes/database.md",
      "docs/tunes/security.md",
      "docs/explorers-earth/integrations.md",
    ]));
    expect(paths.filter((path) => !existsSync(resolve(root, path)))).toEqual([]);
    expect(staleGuidanceFindings(Object.fromEntries(paths.map((path) => [path, read(path)])))).toEqual([]);
  });

  it("publishes executable release launchers and describes test:all at its real scope", () => {
    // Break caught: a clean checkout cannot reproduce release evidence, or test:all overclaims its coverage.
    const guide = read("docs/testing/music-identity-testing.md");
    expect(guide).toContain("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File tunes\\scripts\\music-release-launcher.ps1 -Mode qualification");
    expect(guide).toContain("/usr/bin/env -i HOME=/ PATH=/usr/bin:/bin /bin/sh tunes/scripts/music-release-launcher.sh qualification");
    expect(guide).toContain("`music:test:all` runs `npm test --prefix tunes`");
    expect(guide).toContain("does not run the Explorer, real PostgreSQL, browser, load/chaos, or release lanes");
    expect(guide).toContain("[release evidence template](music-release-evidence-template.md)");
  });

  it("keeps examples disposable and production credentials unset", () => {
    for (const path of [".env.music.example", ".env.music.test.example"]) {
      const source = read(path);
      expect(source).toContain("DATABASE_URL_TEST=postgresql://music_migrator@127.0.0.1:55432/music_fixture");
      expect(source).not.toMatch(/^DATABASE_URL=/m);
      expect(source).not.toMatch(/postgresql:\/\/[^\r\n]*@(?!127\.0\.0\.1)/);
    }
    expect(read(".env.music.example")).toContain("LIVE_STRAPI_READ_ONLY_CREDENTIAL=\n");
  });
});

describe("Music CI publication order", () => {
  it("runs docs contracts on every change and gates release layers in dependency order", () => {
    const path = resolve(root, ".github/workflows/test.yml");
    const workflow = existsSync(path) ? parseYaml(read(".github/workflows/test.yml")) : {};
    expect(workflow.on).toEqual(expect.objectContaining({ pull_request: expect.anything(), push: expect.anything() }));
    expect(workflow.on).not.toHaveProperty("paths-ignore");
    expect(workflow.jobs?.["docs-contracts"]).not.toHaveProperty("needs");
    expect(workflow.jobs?.static).not.toHaveProperty("needs");
    expect(workflow.jobs?.["unit-coverage"]?.needs).toBe("static");
    expect(workflow.jobs?.contracts?.needs).toBe("unit-coverage");
    expect(workflow.jobs?.database?.needs).toBe("contracts");
    expect(workflow.jobs?.security?.needs).toBe("database");
    expect(workflow.jobs?.frontend?.needs).toBe("security");
    expect(workflow.jobs?.browser?.needs).toBe("frontend");
    expect(workflow.jobs?.["load-chaos"]?.needs).toBe("browser");
    expect(workflow.jobs?.["image-deploy-contract"]?.needs).toEqual(["browser", "load-chaos"]);
  });

  it("uses only the explicit disposable database in every database-mutating CI step", () => {
    const path = resolve(root, ".github/workflows/test.yml");
    const workflow = existsSync(path) ? parseYaml(read(".github/workflows/test.yml")) : {};
    const database = workflow.jobs?.database;
    expect(database?.env).toMatchObject({
      DATABASE_URL_TEST: "postgresql://music_migrator:music@127.0.0.1:55432/music_fixture",
      MUSIC_C3_POSTGRES_TEST: "1",
      MUSIC_C4_POSTGRES_TEST: "1",
      MUSIC_C5_POSTGRES_TEST: "1",
      MUSIC_C6_POSTGRES_TEST: "1",
      MUSIC_C7_POSTGRES_TEST: "1",
      MUSIC_C8_POSTGRES_TEST: "1",
      MUSIC_C9_PUBLICATION_POSTGRES_TEST: "1",
    });
    expect(database?.env).not.toHaveProperty("DATABASE_URL");
    expect(JSON.stringify(database?.steps ?? [])).toContain("music_fixture");
  });

  it("does not let general or Music contract CI skip documentation-only changes", () => {
    const general = parseYaml(read(".github/workflows/ci.yml"));
    const music = parseYaml(read(".github/workflows/music-c0-contracts.yml"));
    expect(general.on.pull_request).not.toHaveProperty("paths-ignore");
    expect(general.on.push).not.toHaveProperty("paths-ignore");
    expect(music.on.pull_request.paths).toContain("docs/**");
    expect(music.on.push.paths).toContain("docs/**");
  });
});

describe("POSIX native launcher environment rejection", () => {
  const shell = process.platform === "win32"
    ? "C:\\Program Files\\Git\\bin\\sh.exe"
    : "/bin/sh";

  it.skipIf(!existsSync(shell))("rejects every NODE_* startup authority before mode processing", () => {
    // Break caught: NODE_OPTIONS/NODE_PATH is silently stripped rather than receiving the documented refusal.
    for (const name of ["NODE_OPTIONS", "NODE_PATH", "NODE_EXTRA_CA_CERTS"]) {
      const result = spawnSync(shell, ["-c", `${name}=hostile sh tunes/scripts/music-release-launcher.sh invalid-mode`], {
        encoding: "utf8",
        cwd: root,
        env: process.env,
        windowsHide: true,
      });
      expect(result.status, `${name}: ${result.stderr}`).toBe(78);
      expect(result.stderr).toContain("native Music release launcher rejected Node startup authority");
    }
  });

  it("uses a prefix-complete NODE_* predicate on platforms where the POSIX launcher cannot execute", () => {
    // Windows CI may not expose a POSIX shell, so retain parity with the behavior test above.
    expect(read("tunes/scripts/music-release-launcher.sh"))
      .toContain("/usr/bin/grep -Eq '^NODE(_.*)?='");
  });
});
