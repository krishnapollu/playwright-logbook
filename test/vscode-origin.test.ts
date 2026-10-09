import { expect, it } from 'vitest';
import { runOriginText } from '../packages/vscode/src/runorigin.js';

it('shows storeless local runs and preserves recorded origins', () => {
  expect(runOriginText(null, null, false)).toEqual({ badge: 'Local', detail: null });
  expect(runOriginText(null, null, true)).toEqual({ badge: null, detail: null });
  expect(runOriginText({ type: 'ci', provider: 'github', buildId: '42', attempt: '1' }, null, true)).toMatchObject({ badge: 'CI' });
  const viewer = { projectId: 'pw-test', author: 'Alice' };
  expect(runOriginText({ type: 'local', author: 'Alice' }, viewer, false)).toMatchObject({ badge: 'Local' });
  expect(runOriginText({ type: 'local', author: 'Bob' }, viewer, true)).toMatchObject({ badge: 'Peer' });
});
