import { teamOriginText } from '../../../src/teamstore.js';
import type { TeamOrigin, TeamViewer } from '../../../src/teamstore.js';

export function runOriginText(origin: TeamOrigin | null, viewer: TeamViewer | null, imported: boolean): { badge: string | null; detail: string | null } {
  const display = teamOriginText(origin, viewer);
  return { ...display, badge: display.badge ?? (!origin && !imported ? 'Local' : null) };
}
