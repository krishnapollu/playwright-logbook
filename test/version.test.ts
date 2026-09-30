import { expect, it } from 'vitest';
import fs from 'node:fs';
import { VERSION } from '../src/version.js';

it('matches the package version', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  expect(VERSION).toBe(pkg.version);
});
