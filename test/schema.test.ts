import { expect, it } from 'vitest';
import { parseRun } from '../src/schema.js';

it('rejects unsupported schema versions with a stable error', () => {
  expect(() => parseRun({ schemaVersion: 2 }, 'run.json')).toThrow(/run\.json: invalid run data/);
});
