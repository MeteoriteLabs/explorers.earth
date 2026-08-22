import fs from "node:fs";
import path from "node:path";

function defaultNpmCliPath(execPath, env = process.env) {
  const configured = env.npm_execpath;
  if (configured && fs.existsSync(configured)) return configured;

  const bundled = path.join(path.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (fs.existsSync(bundled)) return bundled;

  throw new Error("NPM_CLI_NOT_FOUND: run through npm or provide npmCliPath");
}

export function createNpmSpawnPlan(
  _platform,
  args,
  {
    execPath = process.execPath,
    npmCliPath = defaultNpmCliPath(execPath),
  } = {},
) {
  return {
    command: execPath,
    args: [npmCliPath, ...args],
    shell: false,
  };
}
