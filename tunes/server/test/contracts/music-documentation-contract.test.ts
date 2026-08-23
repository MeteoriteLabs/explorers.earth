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
type DatabaseInvocationFinding = { path: string; line: number; command: string; code: "invalid-invocation" | "missing-test-target" | "unsafe-reset-arguments" };
type ObsoleteAuthFinding = { path: string; line: number; code: "obsolete-auth-boundary" };

function markdownDocumentTargets(source: string): string[] {
  const inline = [...source.matchAll(/\]\(\s*(?:<([^>\r\n]+\.md(?:#[^>\r\n]*)?)>|([^\s)]+\.md(?:#[^\s)]*)?))(?:\s+(?:"[^"\r\n]*"|'[^'\r\n]*'|\([^()\r\n]*\)))?\s*\)/g)]
    .map(([, bracketed, bare]) => (bracketed ?? bare)!.replace(/#.*$/, ""));
  const references = [...source.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(?:<([^>\r\n]+\.md(?:#[^>\r\n]*)?)>|([^\s]+\.md(?:#[^\s]*)?))/gim)]
    .map(([, bracketed, bare]) => (bracketed ?? bare)!.replace(/#.*$/, ""));
  return [...new Set([...inline, ...references])];
}

function indexedMarkdownDocuments(
  indexSource = read("docs/README.md"),
  sourceFor: (path: string) => string | undefined = (path) => existsSync(resolve(root, path)) ? read(path) : undefined,
): string[] {
  const paths = new Set(["docs/README.md"]);
  const pending = ["docs/README.md"];
  const supplied = new Map([["docs/README.md", indexSource]]);

  while (pending.length > 0) {
    const path = pending.shift()!;
    const source = supplied.get(path) ?? sourceFor(path);
    if (source === undefined) continue;
    for (const rawTarget of markdownDocumentTargets(source)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(rawTarget) || rawTarget.startsWith("/")) continue;
      const target = posix.normalize(posix.join(posix.dirname(path), rawTarget.replaceAll("\\", "/")));
      if (target === ".." || target.startsWith("../") || paths.has(target)) continue;
      paths.add(target);
      const targetSource = sourceFor(target);
      if (targetSource !== undefined) {
        supplied.set(target, targetSource);
        pending.push(target);
      }
    }
  }

  return [...paths].sort();
}

function staleGuidanceFindings(sources: Record<string, string>): StaleGuidanceFinding[] {
  const findings: StaleGuidanceFinding[] = [];
  for (const [path, source] of Object.entries(sources)) {
    source.split(/\r?\n/).forEach((line, index) => {
      if (/\bNode(?:\.?js)?\s+v?18(?:\.\d+)*\+?/i.test(line)) {
        findings.push({ path, line: index + 1, code: "node-18" });
      }
      if (/\bnpm\s+run\s+(?:(?:--silent|-s)\s+)?db:push\b/i.test(line)
        || /\bnpx\s+(?:--yes\s+)?drizzle-kit(?:@[^\s]+)?\s+push\b/i.test(line)) {
        findings.push({ path, line: index + 1, code: "db-push" });
      }
      if (/\bX-Username\b/i.test(line)
        && line.trim() !== "X-Username support was removed from canonical Music routes.") {
        findings.push({ path, line: index + 1, code: "x-username-ownership" });
      }
    });
  }
  return findings;
}

type ShellWords = { words: string[]; valid: boolean };

function shellWords(source: string): ShellWords {
  const words: string[] = [];
  let word = "";
  let quote: "\"" | "'" | undefined;
  let valid = true;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quote) {
      if (character === quote) quote = undefined;
      else if (character === "\\" && quote === "\"" && source[index + 1] !== undefined) word += source[++index]!;
      else word += character;
    } else if (character === "\"" || character === "'") {
      quote = character;
    } else if (character === "#" && word === "") {
      valid = false;
      break;
    } else if (character === "\\") {
      if (source[index + 1] === undefined) valid = false;
      else word += source[++index]!;
    } else if (/\s/.test(character)) {
      if (word) words.push(word);
      word = "";
    } else {
      word += character;
    }
  }
  if (word) words.push(word);
  return { words, valid: valid && quote === undefined };
}

type LogicalShellLine = { text: string; line: number; complete: boolean };

function hasPosixLineContinuation(line: string): boolean {
  const trailingSlashes = line.match(/\\+$/)?.[0].length ?? 0;
  if (trailingSlashes % 2 !== 1) return false;
  let quote: "\"" | "'" | undefined;
  const prefix = line.slice(0, -trailingSlashes);
  for (let index = 0; index < prefix.length; index += 1) {
    const character = prefix[index]!;
    if (quote === "'") {
      if (character === "'") quote = undefined;
    } else if (quote === "\"") {
      if (character === "\"") quote = undefined;
      else if (character === "\\") index += 1;
    } else if (character === "\"" || character === "'") {
      quote = character;
    } else if (character === "\\") {
      index += 1;
    }
  }
  return quote !== "'";
}

function logicalShellLines(source: string): LogicalShellLine[] {
  const logical: LogicalShellLine[] = [];
  const physical = source.split(/\r?\n/);
  let text = "";
  let startLine = 1;
  physical.forEach((line, index) => {
    if (!text) startLine = index + 1;
    const continued = hasPosixLineContinuation(line);
    text += continued ? `${line.slice(0, -1)} ` : line;
    if (!continued) {
      logical.push({ text, line: startLine, complete: true });
      text = "";
    } else if (index === physical.length - 1) {
      logical.push({ text, line: startLine, complete: false });
      text = "";
    }
  });
  return logical;
}

function documentedDatabaseInvocations(line: string): Array<{ command: string; invocation: string }> {
  const commandPattern = /\bnpm\s+run\b[^;&|`\r\n]*?\b(music:db:(?:status|migrate|verify|reset))\b/gi;
  const matches = [...line.matchAll(commandPattern)];
  return matches.map((match, index) => {
    const start = match.index!;
    const nextStart = matches[index + 1]?.index ?? line.length;
    const afterCommand = start + match[0].length;
    let end = nextStart;
    let quote: "\"" | "'" | undefined;
    for (let cursor = afterCommand; cursor < nextStart; cursor += 1) {
      const character = line[cursor]!;
      if (quote) {
        if (character === quote) quote = undefined;
        else if (character === "\\" && quote === "\"") cursor += 1;
        continue;
      }
      if (character === "\"" || character === "'") quote = character;
      else if (character === "`" || character === ";" || character === "|"
        || (character === "&" && line[cursor + 1] === "&")) {
        end = cursor;
        break;
      }
    }
    return { command: match[1]!, invocation: line.slice(start, end).trim() };
  });
}

type DocumentedDatabaseValidation = { code?: DatabaseInvocationFinding["code"] };

function validateDocumentedDatabaseInvocation(command: string, invocation: string, complete: boolean): DocumentedDatabaseValidation {
  const parsed = shellWords(invocation);
  if (!complete || !parsed.valid) return { code: "invalid-invocation" };
  const words = parsed.words;
  let index = 0;
  if (words[index++] !== "npm" || words[index++] !== "run") return { code: "invalid-invocation" };
  if (words[index] === "--silent" || words[index] === "-s") index += 1;
  if (words[index++] !== command || words[index++] !== "--") return { code: "invalid-invocation" };

  const allowed = new Set(["--mode", "--format", "--target"]);
  if (command === "music:db:reset") {
    allowed.add("--confirm-project");
    allowed.add("--confirm-reset");
  }
  const values = new Map<string, string>();
  while (index < words.length) {
    const flag = words[index++]!;
    const value = words[index++];
    if (!allowed.has(flag) || value === undefined || value.startsWith("--") || values.has(flag)) {
      return { code: "invalid-invocation" };
    }
    values.set(flag, value);
  }
  if (values.has("--mode") && values.get("--mode") !== "fixture") return { code: "invalid-invocation" };
  if (values.has("--format") && !["human", "json"].includes(values.get("--format")!)) return { code: "invalid-invocation" };
  if (values.get("--target") !== "test") return { code: "missing-test-target" };
  if (command === "music:db:reset"
    && (values.get("--mode") !== "fixture"
      || values.get("--confirm-project") !== "explorers-music-fixture"
      || values.get("--confirm-reset") !== "RESET explorers-music-fixture/music_fixture")) {
    return { code: "unsafe-reset-arguments" };
  }
  return {};
}

function databaseInvocationFindings(sources: Record<string, string>): DatabaseInvocationFinding[] {
  const findings: DatabaseInvocationFinding[] = [];
  for (const [path, source] of Object.entries(sources)) {
    logicalShellLines(source).forEach((line) => {
      for (const { command, invocation } of documentedDatabaseInvocations(line.text)) {
        const { code } = validateDocumentedDatabaseInvocation(command, invocation, line.complete);
        if (code) findings.push({ path, line: line.line, command, code });
      }
    });
  }
  return findings;
}

function obsoleteAuthFindings(sources: Record<string, string>): ObsoleteAuthFinding[] {
  const findings: ObsoleteAuthFinding[] = [];
  const obsolete = /\/api\/auth\/(?:\*|[a-z][a-z-]*)|\bdual[- ]auth\b|\bmulti[- ]auth\s+fallback\b|\bcross-app\s+sso\b|\bbackground\s+sso\b|\bsso\s+flow\b|apiClient\s*\+\s*SSO|\bJWT\+REST\b[^\r\n]*\btunes\b/i;
  for (const [path, source] of Object.entries(sources)) {
    source.split(/\r?\n/).forEach((line, index) => {
      const sessionCredentialText = "(?:(?:Tunes|native Tunes)\\s+session(?:[- ]cookie)?|session[- ]cookie)";
      const explorerBearerText = "(?:(?:Explorer|Strapi)(?:'s)?\\s+(?:JWT|bearer)|(?:JWT|bearer)\\s+(?:from|issued\\s+by)\\s+(?:Explorer|Strapi))";
      const sessionCookie = new RegExp(`\\b${sessionCredentialText}\\b`, "i").test(line);
      const explorerBearer = new RegExp(`\\b${explorerBearerText}\\b`, "i").test(line);
      const directOrChoice = new RegExp(
        `(?:${sessionCredentialText}[^.;]{0,80}\\bor\\b[^.;]{0,80}${explorerBearerText}|${explorerBearerText}[^.;]{0,80}\\bor\\b[^.;]{0,80}${sessionCredentialText})`,
        "i",
      ).test(line);
      const fallbackTerm = /\b(?:fallback|falls?\s+back|falling\s+back)\b/i.test(line);
      const negatedFallback = /\b(?:never|no|not|without)\b[^.;]{0,24}\b(?:fallback|falls?\s+back|falling\s+back)\b/i.test(line);
      const fallbackChoice = /\beither\b/i.test(line) || directOrChoice || (fallbackTerm && !negatedFallback);
      if (obsolete.test(line) || (sessionCookie && explorerBearer && fallbackChoice)) {
        findings.push({ path, line: index + 1, code: "obsolete-auth-boundary" });
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
        "X-Username is never removed and still establishes the playlist owner.",
        "The removed fallback accepts X-Username and maps it to the owner.",
        "X-Username is not owner authority, but the server maps it to the owner.",
        "No authorization decision may use X-Username, but it still maps users to owners.",
        "X-Username is not owner authority. Yet the server maps it to the owner.",
        "X-Username support was removed from canonical Music routes. The legacy bridge still accepts it for owner lookup.",
        "No authorization decision may use X-Username.",
        "The server still maps it to the owner.",
      ].join("\n"),
    })).toEqual([
      { path: "docs/hostile.md", line: 1, code: "node-18" },
      { path: "docs/hostile.md", line: 2, code: "db-push" },
      { path: "docs/hostile.md", line: 3, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 4, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 5, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 6, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 7, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 8, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 9, code: "x-username-ownership" },
      { path: "docs/hostile.md", line: 10, code: "x-username-ownership" },
    ]);
  });

  it("detects current stale runtime and schema-mutation spellings", () => {
    expect(staleGuidanceFindings({
      "docs/stale-spellings.md": [
        "Use Node v18.20+ for this project.",
        "Run npx drizzle-kit push against production.",
        "Run npm run --silent db:push before deployment.",
        "Run npm run -s db:push before deployment.",
      ].join("\n"),
    })).toEqual([
      { path: "docs/stale-spellings.md", line: 1, code: "node-18" },
      { path: "docs/stale-spellings.md", line: 2, code: "db-push" },
      { path: "docs/stale-spellings.md", line: 3, code: "db-push" },
      { path: "docs/stale-spellings.md", line: 4, code: "db-push" },
    ]);
  });

  it("allows only precise explicit X-Username retirement statements", () => {
    expect(staleGuidanceFindings({
      "docs/retired.md": [
        "X-Username support was removed from canonical Music routes.",
        "The signed Music credential establishes numeric owner authority.",
      ].join("\n"),
    })).toEqual([]);
  });

  it("rejects every noncanonical X-Username statement without flagging credential ownership", () => {
    expect(staleGuidanceFindings({
      "docs/noncanonical.md": [
        "X-Username is not owner authority; the signed Music credential establishes the owner.",
        "No authorization decision may use X-Username as owner authority.",
        "The signed Music credential establishes numeric owner authority.",
      ].join("\n"),
    })).toEqual([
      { path: "docs/noncanonical.md", line: 1, code: "x-username-ownership" },
      { path: "docs/noncanonical.md", line: 2, code: "x-username-ownership" },
    ]);
  });

  it("rejects an affirmative X-Username owner claim before a retirement sentence", () => {
    expect(staleGuidanceFindings({
      "docs/contradictory.md": [
        "The legacy bridge accepts X-Username for owner lookup.",
        "X-Username support was removed from canonical Music routes.",
      ].join("\n"),
    })).toEqual([
      { path: "docs/contradictory.md", line: 1, code: "x-username-ownership" },
    ]);
  });

  it("rejects incomplete or mis-targeted documented fixture database invocations", () => {
    const cli = read("tunes/scripts/music-cli.ts");
    expect(cli).toContain('if (["db:status", "db:migrate", "db:verify"].includes(parsed.command))');
    expect(cli).toContain('if (parsed.target !== "test") throw new SafetyError("database command requires explicit --target test"');
    expect(databaseInvocationFindings({
      "docs/hostile.md": [
        "`npm run music:db:status`",
        "`npm run music:db:migrate -- --target production`",
        "`npm run music:db:verify --target test`",
        "`npm run music:db:status -- --mode fixture --target test`",
        "`npm run --silent music:db:migrate -- --target production`",
        "`npm run music:db:status -- --target test && npm run music:db:verify`",
        "`npm run music:db:migrate && npm run music:db:status -- --target test`",
        "`npm run music:db:reset -- --mode fixture --target test`",
        "`npm run music:db:reset -- --mode fixture --target test --confirm-project explorers-music-fixture --confirm-reset \"RESET explorers-music-fixture/music_fixture\"`",
        "`npm run music:db:reset -- --mode fixture --target test --target production --confirm-project explorers-music-fixture --confirm-reset \"RESET explorers-music-fixture/music_fixture\"`",
      ].join("\n"),
    })).toEqual([
      { path: "docs/hostile.md", line: 1, command: "music:db:status", code: "invalid-invocation" },
      { path: "docs/hostile.md", line: 2, command: "music:db:migrate", code: "missing-test-target" },
      { path: "docs/hostile.md", line: 3, command: "music:db:verify", code: "invalid-invocation" },
      { path: "docs/hostile.md", line: 5, command: "music:db:migrate", code: "missing-test-target" },
      { path: "docs/hostile.md", line: 6, command: "music:db:verify", code: "invalid-invocation" },
      { path: "docs/hostile.md", line: 7, command: "music:db:migrate", code: "invalid-invocation" },
      { path: "docs/hostile.md", line: 8, command: "music:db:reset", code: "unsafe-reset-arguments" },
      { path: "docs/hostile.md", line: 10, command: "music:db:reset", code: "invalid-invocation" },
    ]);
  });

  it("rejects malformed database grammar and accepts reordered and continued invocations", () => {
    const malformed = [
      "`npm run music:db:status -- --target test --force`",
      "`npm run music:db:verify -- --target \"test`",
      "`npm run music:db:migrate -- --target test # replace test with production`",
      "`npm run music:db:status -- --mode fixture --mode fixture --target test`",
      "`npm run music:db:verify -- --target test --format human --format json`",
      "`npm run music:db:migrate -- --target test production`",
      "`npm run music:db:reset -- --confirm-reset \"RESET explorers-music-fixture/music_fixture\" --target test --confirm-project explorers-music-fixture --mode fixture --force`",
      "`npm run music:db:status -- --target test --target test`",
      "`npm run music:db:verify -- --format json --target test --mode fixture`",
      "`npm run music:db:reset -- --confirm-reset \"RESET explorers-music-fixture/music_fixture\" --format human --target test --confirm-project explorers-music-fixture --mode fixture`",
      "`npm run --bogus music:db:status -- --target test`",
    ].join("\n");
    const continued = [
      "npm run music:db:migrate -- \\",
      "  --format human \\",
      "  --target test \\",
      "  --mode fixture",
    ].join("\n");
    const invalidContinuation = [
      "npm run music:db:status -- --target test \\ ",
      "  --mode fixture",
    ].join("\n");
    expect(databaseInvocationFindings({
      "docs/malformed.md": malformed,
      "docs/continued.md": continued,
      "docs/invalid-continuation.md": invalidContinuation,
    })).toEqual([
      { path: "docs/malformed.md", line: 1, command: "music:db:status", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 2, command: "music:db:verify", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 3, command: "music:db:migrate", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 4, command: "music:db:status", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 5, command: "music:db:verify", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 6, command: "music:db:migrate", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 7, command: "music:db:reset", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 8, command: "music:db:status", code: "invalid-invocation" },
      { path: "docs/malformed.md", line: 11, command: "music:db:status", code: "invalid-invocation" },
      { path: "docs/invalid-continuation.md", line: 1, command: "music:db:status", code: "invalid-invocation" },
    ]);
  });

  it("supersedes manual-only testing, authentication, migration, and mutable deployment guidance", () => {
    const testing = read("docs/testing.md");
    expect(testing).toContain("[Music identity testing guide](testing/music-identity-testing.md)");
    expect(testing).toContain("npm run music:test:pr -- --mode fixture");
    expect(testing).not.toMatch(/Manual API testing|Test WebSocket events by|Future Testing Improvements/);

    const authAdr = read("docs/adr/002-auth-strategies.md");
    expect(authAdr).toMatch(/## Status\s+Superseded in part/i);
    expect(authAdr).toContain("short-lived Music credential");
    expect(authAdr).toContain("../architecture/music-identity.md");
    expect(authAdr).toContain("Explorer bearer is forwarded only to `POST /api/music/identity/ensure`");
    expect(authAdr).toContain("never reused on canonical owner routes");
    expect(authAdr).not.toMatch(/No single sign-on across apps|users have separate accounts|JWT for both.*Rejected/is);
    const authModel = read("docs/security/music-auth-model.md");
    expect(authModel).toContain("Canonical owner REST and Socket.IO routes accept that credential only.");
    expect(authModel).toContain("A separately opened native Tunes session is confined to its documented login/logout/check/CSRF endpoints.");
    expect(authModel).toContain("X-Username support was removed from canonical Music routes.");

    const databaseAdr = read("docs/adr/004-database-orm-choice.md");
    expect(databaseAdr).toMatch(/## Status\s+Superseded in part/i);
    expect(databaseAdr).toContain("append-only SQL migrations");
    expect(databaseAdr).not.toMatch(/db:push|push-based|no migration files/i);

    const deployment = read("docs/tunes/deployment.md");
    expect(deployment).toContain(".github/workflows/tunes.yml");
    expect(deployment).toContain("[immutable deployment runbook](../operations/music-deploy-runbook.md)");
    expect(deployment).toContain("full-commit tag");
    expect(deployment).not.toMatch(/Jenkins|drizzle-kit push|docker-compose build|Update ECS service/i);
  });

  it("follows reference-style Markdown links recursively", () => {
    const fixtureSources: Record<string, string> = {
      "docs/README.md": "Read the [child][child-contract].\n\n[child-contract]: nested/child.md",
      "docs/nested/child.md": "Continue with the [grandchild][grandchild-contract].\n\n[grandchild-contract]: ../grandchild.md",
      "docs/grandchild.md": "# Grandchild",
    };
    expect(indexedMarkdownDocuments(fixtureSources["docs/README.md"], (path: string) => fixtureSources[path]))
      .toEqual(["docs/README.md", "docs/grandchild.md", "docs/nested/child.md"]);
  });

  it("follows titled inline Markdown links recursively", () => {
    const fixtureSources: Record<string, string> = {
      "docs/README.md": "Read the [child contract](nested/child.md \"Child title\").",
      "docs/nested/child.md": "# Child",
    };
    expect(indexedMarkdownDocuments(fixtureSources["docs/README.md"], (path: string) => fixtureSources[path]))
      .toEqual(["docs/README.md", "docs/nested/child.md"]);
  });

  it("detects obsolete canonical Music authentication boundary claims", () => {
    expect(obsoleteAuthFindings({
      "docs/hostile.md": [
        "Call POST /api/auth/logout.",
        "Tunes uses dual auth: session plus JWT.",
        "Legacy routes provide a multi-auth fallback.",
        "The embedded Music dashboard uses Cross-App SSO.",
        "Embedded Music accepts either a Tunes session cookie or the Explorer JWT.",
        "Owner routes use the Explorer JWT, falling back to the Tunes session cookie.",
      ].join("\n"),
    })).toEqual([
      { path: "docs/hostile.md", line: 1, code: "obsolete-auth-boundary" },
      { path: "docs/hostile.md", line: 2, code: "obsolete-auth-boundary" },
      { path: "docs/hostile.md", line: 3, code: "obsolete-auth-boundary" },
      { path: "docs/hostile.md", line: 4, code: "obsolete-auth-boundary" },
      { path: "docs/hostile.md", line: 5, code: "obsolete-auth-boundary" },
      { path: "docs/hostile.md", line: 6, code: "obsolete-auth-boundary" },
    ]);
  });

  it("allows the canonical standalone-session and embedded-credential separation", () => {
    expect(obsoleteAuthFindings({
      "docs/canonical.md": [
        "Standalone Tunes sessions are confined to login, logout, check, and CSRF endpoints.",
        "The Explorer bearer is forwarded only to POST /api/music/identity/ensure; canonical owner routes accept only the short-lived Music credential.",
      ].join("\n"),
    })).toEqual([]);
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
    const sources = Object.fromEntries(paths.map((path) => [path, read(path)]));
    expect(staleGuidanceFindings(sources)).toEqual([]);
    expect(databaseInvocationFindings(sources)).toEqual([]);
    expect(obsoleteAuthFindings(sources)).toEqual([]);
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
