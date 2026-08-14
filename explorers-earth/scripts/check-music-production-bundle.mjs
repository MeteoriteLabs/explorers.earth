import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const forbidden = /fixtureMode|fixtureHttpAllowed|http:\/\/(?:127\.0\.0\.1|localhost):55000/;

function productionSources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" || entry.name === "test" ? [] : productionSources(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function builtArtifacts(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? builtArtifacts(path) : [path];
  });
}

for (const path of [...productionSources(join(root, "src")), ...builtArtifacts(join(root, "dist"))]) {
  const bytes = readFileSync(path);
  if (bytes.includes(0)) continue;
  if (forbidden.test(bytes.toString("utf8"))) {
    throw new Error("Production Explorer source or bundle contains the removed Music fixture HTTP capability");
  }
}

process.stdout.write("Explorer production Music transport contract: HTTPS-only\n");
