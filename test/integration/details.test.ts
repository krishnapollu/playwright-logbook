import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sample = path.join(root, 'fixtures', 'sample-project');
const cli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');

describe('captureDetails integration', () => {
  it('stores sanitized steps, output and a failed PNG in the isolated fixture', () => {
    const runId = 'details-integration';
    const result = spawnSync(process.execPath, [cli, 'test', '--config=playwright.details.config.ts'], {
      cwd: sample, env: { ...process.env, LOGBOOK_RUN_ID: runId }, encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(1);
    const file = path.join(sample, '.logbook-details', 'runs', `${runId}.json`);
    const run = JSON.parse(fs.readFileSync(file, 'utf8')) as { tests: { attempts: { steps: { title: string; depth: number; failed: boolean }[]; stdout: string | null; attachments: { dataUri?: string }[] }[] }[] };
    const attempt = run.tests[0]!.attempts[0]!;
    expect(attempt.steps.some((step) => step.title === 'inner detail step' && step.depth === 1 && step.failed)).toBe(true);
    expect(attempt.stdout).toContain('details stdout marker');
    expect(attempt.attachments.some((item) => item.dataUri?.startsWith('data:image/png;base64,'))).toBe(true);
    expect(JSON.stringify(run)).not.toContain(sample);
  }, 30_000);
});
