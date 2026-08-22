import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function list(script) {
  const command = `${npmCommand} run ${script} -- --list`;
  return spawnSync(command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      CI: "",
    },
  });
}

test("normal E2E discovery includes deterministic tests and excludes protected account specs", () => {
  const result = list("test:e2e");

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[deterministic\]/);
  assert.doesNotMatch(result.stdout, /real-account[\\/]/i);
  assert.doesNotMatch(result.stdout, /approved live profile writes/i);
});

test("protected E2E discovery includes only the serialized real-account project", () => {
  const result = list("test:e2e:real-account");

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[real-account\]/);
  assert.match(result.stdout, /real-account[\\/]/i);
  assert.doesNotMatch(result.stdout, /\[deterministic\]/);
});
