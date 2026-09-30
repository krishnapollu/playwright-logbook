import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const script = path.join(root, 'scripts', 'make-demo.mjs');

async function files(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(dir, prefix), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const name = path.posix.join(prefix, entry.name);
    return entry.isDirectory() ? files(dir, name) : [name];
  }));
  return nested.flat().sort();
}

describe('deterministic demo report', () => {
  it('creates the same complete 12-run dataset and report twice', async () => {
    const first = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-demo-a-'));
    const second = await fs.mkdtemp(path.join(os.tmpdir(), 'logbook-demo-b-'));
    try {
      for (const target of [first, second]) {
        const result = spawnSync(process.execPath, [script, target], { cwd: root, encoding: 'utf8' });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout.trim()).toBe(path.join(target, 'report', 'index.html'));
      }
      const names = await files(first);
      expect(names).toEqual(await files(second));
      expect(names.filter((name) => name.startsWith('runs/'))).toHaveLength(12);
      expect(names.filter((name) => name.startsWith('shards/'))).toHaveLength(15);
      expect(names).toContain('report/index.html');
      for (const name of names) {
        expect(await fs.readFile(path.join(first, name))).toEqual(await fs.readFile(path.join(second, name)));
      }
      const latest = JSON.parse(await fs.readFile(path.join(first, 'runs', 'demo-12.json'), 'utf8'));
      expect(latest.tests).toHaveLength(80);
      expect(latest.receivedShards).toEqual([1, 2, 3, 4]);
      expect(latest.complete).toBe(true);
      expect(new Set(latest.tests.map((test: { file: string }) => test.file)).size).toBe(10);
      expect(new Set(latest.tests.map((test: { project: string }) => test.project))).toEqual(new Set(['chromium', 'firefox', 'mobile']));
      const html = await fs.readFile(path.join(first, 'report', 'index.html'), 'utf8');
      const model = JSON.parse(html.match(/<script type="application\/json" id="lb-data">([\s\S]*?)<\/script>/)?.[1] ?? 'null');
      expect(model.comparison.newFailures).toHaveLength(1);
      expect(model.comparison.fixed).toHaveLength(1);
      expect(model.flaky).toHaveLength(3);
      expect(html).toContain('https://ci.example.test/builds/demo-12');
      expect(html).toContain('data-tab="tests"');
    } finally {
      await Promise.all([first, second].map((dir) => fs.rm(dir, { recursive: true, force: true })));
    }
  }, 30_000);
});
