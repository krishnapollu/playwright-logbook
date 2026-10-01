import type { DebugEvidence } from './debugpacket.js';

export interface DebugSignal { id: string; label: string; explanation: string; evidenceIds: string[] }

/** Conservative, evidence-linked clues. These are not root-cause diagnoses. */
export function detectSignals(evidence: DebugEvidence[], outcome: string): DebugSignal[] {
  const signals: DebugSignal[] = [];
  const errors = evidence.filter((item) => item.kind === 'error');
  const steps = evidence.filter((item) => item.kind === 'step');
  const attempts = evidence.filter((item) => item.kind === 'attempt');
  const history = evidence.find((item) => item.kind === 'history');
  const findPair = (errorPattern: RegExp, stepPattern: RegExp): [DebugEvidence, DebugEvidence] | null => {
    for (const error of errors) {
      const retry = error.id.split(':')[1];
      const step = steps.find((item) => item.id.startsWith(`step:retry-${retry}:`) && /; failed\b/.test(item.text) && stepPattern.test(item.text));
      if (step && errorPattern.test(error.text)) return [error, step];
    }
    return null;
  };
  const locator = findPair(/(?:locator\.|Locator:[\s\S]*Timeout:|waiting for locator|Timeout .*exceeded)/i, /^(?:(?:pw:api|test\.step):.*(?:locator|click|fill|waitFor)|expect: Expect "toBeVisible")/i);
  if (locator) signals.push({ id: 'locator-timeout', label: 'Locator operation timed out', explanation: 'A failed locator-related step and timeout evidence are recorded on the same attempt. Check selector state and timing.', evidenceIds: locator.map((item) => item.id) });
  const assertion = findPair(/(?:expect\(|expect\.|AssertionError|Expected:)/i, /^(?:expect|test\.step):/i);
  if (assertion && (!locator || assertion[0].id !== locator[0].id)) signals.push({ id: 'assertion', label: 'Assertion failed', explanation: 'A failed assertion step and its error are recorded on the same attempt. Inspect the expected and actual values.', evidenceIds: assertion.map((item) => item.id) });
  const navigation = findPair(/(?:page\.goto|net::ERR_|Navigation failed)/i, /^(?:pw:api|test\.step):.*(?:goto|navigate)/i);
  if (navigation) signals.push({ id: 'navigation', label: 'Navigation failed', explanation: 'A navigation step failed with a matching error. Inspect the URL and page availability.', evidenceIds: navigation.map((item) => item.id) });
  const failedAttempt = attempts.find((item) => /: (?:failed|timedOut|interrupted);/.test(item.text));
  const passedAttempt = attempts.find((item) => /: passed;/.test(item.text));
  if (outcome === 'flaky' && failedAttempt && passedAttempt) signals.push({ id: 'retry-changed-outcome', label: 'Passed after a failed attempt', explanation: 'The recorded attempts changed outcome. This is not evidence that the underlying issue is fixed.', evidenceIds: [failedAttempt.id, passedAttempt.id] });
  if (outcome === 'unexpected' && history && /: [pfks-]*p$/.test(history.text)) {
    const failure = errors[0] ?? failedAttempt;
    if (failure) signals.push({ id: 'new-failure', label: 'Failed after a prior pass', explanation: 'The previous recorded result passed; this run failed. Compare recent changes before assigning a cause.', evidenceIds: [history.id, failure.id] });
  }
  return signals.length ? signals : [{ id: 'unknown', label: 'No specific clue', explanation: 'Available evidence does not support a specific debugging clue. Inspect the error and trace manually.', evidenceIds: [] }];
}
