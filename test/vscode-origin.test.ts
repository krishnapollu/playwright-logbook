import { expect, it } from 'vitest';
import { runOriginText } from '../packages/vscode/src/presentation.js';

it('shows storeless local runs without making them eligible for team push', () => {
  expect(runOriginText(null, null, false)).toEqual({ badge: 'Local', detail: null, canPush: false });
  expect(runOriginText(null, null, true)).toEqual({ badge: null, detail: null, canPush: false });
  expect(runOriginText({ type: 'ci', provider: 'github', buildId: '42', attempt: '1' }, null, true)).toMatchObject({ badge: 'CI', canPush: false });
  const viewer = { projectId: 'pw-test', author: 'Alice' };
  expect(runOriginText({ type: 'local', author: 'Alice' }, viewer, false)).toMatchObject({ badge: 'Local', canPush: true });
  expect(runOriginText({ type: 'local', author: 'Bob' }, viewer, true)).toMatchObject({ badge: 'Peer', canPush: false });
});
