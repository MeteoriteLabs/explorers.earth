import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type Identity = { project: string; title: string; file: string };
type ListSuite = {
  title: string;
  file?: string;
  specs?: { title: string; file: string; tests: { projectName: string }[] }[];
  suites?: ListSuite[];
};
const root = resolve(import.meta.dirname, '../../..');
const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, 'category-discovery-manifest.json'), 'utf8')) as Omit<Identity, 'file'>[];

function discover(config: string): Identity[] {
  const cli = resolve(root, 'node_modules/@playwright/test/cli.js');
  const result = spawnSync(process.execPath, [cli, 'test', `--config=${config}`, '--list', '--reporter=json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' },
  });
  expect(result.status, `${config}: ${result.stderr}`).toBe(0);
  const report = JSON.parse(result.stdout) as { suites: ListSuite[] };
  const identities: Identity[] = [];
  function walk(suites: ListSuite[], parents: string[] = []) {
    for (const suite of suites) {
      const prefix = suite.file ? parents : [...parents, suite.title];
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests) {
          identities.push({ project: test.projectName, title: [...prefix, spec.title].join(' '), file: spec.file });
        }
      }
      walk(suite.suites ?? [], prefix);
    }
  }
  walk(report.suites);
  return identities;
}

const key = ({ project, title }: Omit<Identity, 'file'>) => `${project}\u0000${title}`;
const keys = (items: Omit<Identity, 'file'>[]) => items.map(key).sort();

describe('category and publishing discovery', () => {
  it('keeps the 45 baseline project/title identities once across both PR lanes and nightly discovery', () => {
    const category = discover('playwright.category-navigation.config.ts');
    const a = discover('playwright.category-navigation-a.config.ts');
    const b = discover('playwright.category-navigation-b.config.ts');
    expect(category).toHaveLength(45);
    expect(keys(category)).toEqual(keys(manifest));
    expect(keys([...a, ...b])).toEqual(keys(manifest));
    expect(new Set(keys(a)).size).toBe(a.length);
    expect(new Set(keys(b)).size).toBe(b.length);
    expect(a.every((item) => item.file.endsWith('category-navigation-a.spec.ts'))).toBe(true);
    expect(b.every((item) => item.file.endsWith('category-navigation-b.spec.ts'))).toBe(true);
    const moved = (item: Identity) => item.title.includes('Settings Off → guest fallback → header On → explicit manual Pin');
    expect(a.filter(moved)).toHaveLength(0);
    expect(b.filter(moved)).toHaveLength(8);
  });

  it('keeps publishing isolated from category discovery', () => {
    const publishing = discover('playwright.music-publishing.config.ts');
    expect(publishing).toHaveLength(69);
    expect(publishing.every((item) => item.file.endsWith('music-publish-controls.spec.ts'))).toBe(true);
  });
});
