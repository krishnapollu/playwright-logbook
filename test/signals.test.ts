import { expect, it } from 'vitest';
import { detectSignals } from '../src/signals.js';
import type { DebugEvidence } from '../src/debugpacket.js';

const evidence = (id: string, kind: string, text: string): DebugEvidence => ({ id, kind, text });

it('links assertion clues to the failed step and error on the same attempt', () => {
  const items = [
    evidence('error:0:0', 'error', 'Error: expect(received).toBe(expected) Expected: 2'),
    evidence('step:retry-0:0', 'step', 'expect: Expect "toBe"; 1 ms; failed'),
    evidence('attempt:0', 'attempt', 'Retry 0: failed; 2 ms'),
  ];
  expect(detectSignals(items, 'unexpected')[0]).toMatchObject({ id: 'assertion', evidenceIds: ['error:0:0', 'step:retry-0:0'] });
  expect(detectSignals([items[0]!, evidence('step:retry-1:0', 'step', items[1]!.text)], 'unexpected')).toMatchObject([{ id: 'unknown' }]);
});

it('requires a matching failed API step for locator or navigation clues', () => {
  const locator = [evidence('error:0:0', 'error', 'locator.click: Timeout 30000ms exceeded'), evidence('step:retry-0:0', 'step', 'pw:api: locator.click; 30000 ms; failed')];
  expect(detectSignals(locator, 'unexpected')[0]?.id).toBe('locator-timeout');
  expect(detectSignals([locator[0]!], 'unexpected')[0]?.id).toBe('unknown');
  const visible = [evidence('error:0:0', 'error', 'expect(locator).toBeVisible() failed\nLocator: getByRole(button)\nTimeout: 350ms'), evidence('step:retry-0:0', 'step', 'expect: Expect "toBeVisible"; 354 ms; failed')];
  expect(detectSignals(visible, 'unexpected').map((item) => item.id)).toEqual(['locator-timeout']);
  expect(detectSignals([visible[0]!, evidence('step:retry-0:0', 'step', 'expect: Expect "toBeVisible"; 354 ms')], 'unexpected')[0]?.id).toBe('unknown');
  const navigation = [evidence('error:1:0', 'error', 'page.goto: net::ERR_CONNECTION_REFUSED'), evidence('step:retry-1:0', 'step', 'pw:api: page.goto; 10 ms; failed')];
  expect(detectSignals(navigation, 'unexpected')[0]?.id).toBe('navigation');
  expect(detectSignals([navigation[0]!, evidence('step:retry-1:0', 'step', 'pw:api: locator.click; 10 ms; failed')], 'unexpected')[0]?.id).toBe('unknown');
});

it('describes retry and prior-pass changes without claiming a root cause', () => {
  const attempts = [evidence('attempt:0', 'attempt', 'Retry 0: failed; 1 ms'), evidence('attempt:1', 'attempt', 'Retry 1: passed; 1 ms')];
  expect(detectSignals(attempts, 'flaky')[0]).toMatchObject({ id: 'retry-changed-outcome', evidenceIds: ['attempt:0', 'attempt:1'] });
  expect(detectSignals(attempts, 'expected')[0]?.id).toBe('unknown');
  const prior = [attempts[0]!, evidence('error:0:0', 'error', 'Something failed'), evidence('history:0', 'history', 'Previous outcomes (oldest to newest): p')];
  expect(detectSignals(prior, 'unexpected')[0]).toMatchObject({ id: 'new-failure', evidenceIds: ['history:0', 'error:0:0'] });
  expect(detectSignals(prior.slice(0, 2), 'unexpected')[0]?.id).toBe('unknown');
});
