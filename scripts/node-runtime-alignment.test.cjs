const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const digest = 'ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1';
test('production and fixture builders use the reviewed Node 24.21.0 image', () => {
  for (const file of ['tunes/Dockerfile', 'explorers-earth/Dockerfile', 'explorers-earth/Dockerfile.music-fixture']) {
    assert.match(read(file), new RegExp(`FROM public\\.ecr\\.aws/docker/library/node:24\\.21\\.0-alpine@sha256:${digest}`));
    assert.match(read(file), /npm ci.*--engine-strict/);
  }
  assert.match(read('tunes/scripts/music-docker-release-authority.ts'), new RegExp(`node@sha256:${digest}`));
});
test('development, CI, and protected native authorities agree on Node 24.21.0', () => {
  for (const file of ['package.json', 'tunes/package.json', 'explorers-earth/package.json']) {
    assert.equal(JSON.parse(read(file)).engines.node, '^24.21.0');
    const lock = JSON.parse(read(file.replace('package.json', 'package-lock.json')));
    assert.equal(lock.packages[''].engines.node, '^24.21.0');
  }
  for (const file of ['.nvmrc', 'tunes/.nvmrc', 'explorers-earth/.nvmrc']) assert.equal(read(file).trim(), '24.21.0');
  for (const file of ['.github/workflows/test.yml', '.github/workflows/tunes.yml', '.github/workflows/music-c0-contracts.yml', '.github/workflows/music-reconcile.yml']) {
    assert.doesNotMatch(read(file), /node-version:\s*["']?22\./);
    assert.match(read(file), /node-version:\s*["']?24\.21\.0/);
  }
  const workflow = read('.github/workflows/test.yml');
  assert.match(workflow, /fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6/);
  assert.match(workflow, /8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7/);
  for (const file of ['tunes/scripts/music-release-launcher.ps1', 'tunes/scripts/music-release-launcher.sh']) {
    assert.match(read(file), /v24\.21\.0/);
    assert.doesNotMatch(read(file), /v22\.12\.0/);
  }
  assert.doesNotMatch(read('tunes/scripts/music-cli.ts'), /Node >=22\.12 is required/);
});
