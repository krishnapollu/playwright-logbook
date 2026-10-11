import * as clientlib from './clientlib.js';
import { buildDebugPacket, debugPacketMarkdown } from './debugpacket.js';
import { detectSignals } from './signals.js';
import { REPORT_CSS } from './template/css.js';
import { ICONS } from './template/icons.js';
import { CORE_JS } from './template/js/core.js';
import { OVERVIEW_JS } from './template/js/overview.js';
import { TESTS_JS } from './template/js/tests.js';
import { PANEL_JS } from './template/js/panel.js';
import { FAILURES_JS } from './template/js/failures.js';
import { TRENDS_JS } from './template/js/trends.js';
import { RUN_JS } from './template/js/run.js';
import { PROJECT_JS } from './template/js/project.js';

export function buildStyles(): string {
  return REPORT_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\.panel-backdrop\{[^}]*\}/g, '')
    .replace(/\.detail-panel\[hidden\],\.panel-backdrop\[hidden\]\{[^}]*\}/g, '')
    .replace(/\.focused-report \.panel-backdrop,/g, '')
    .replace(/(^|[:\s,(])0px(?=[;\s,)])/g, '$10')
    .replace(/,\s+/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~])\s*/g, '$1')
    .replace(/;}/g, '}');
}

export function buildClientScript(): string {
  const used = new Set(['buildHash', 'filterTests', 'formatDuration', 'heatLevel', 'parseHash', 'recentToKinds', 'rerunCommand', 'safeHref', 'sortTests', 'statusKind', 'traceCommand']);
  const pure = Object.entries(clientlib).filter(([name, value]) => used.has(name) && typeof value === 'function');
  return `(function(){'use strict';\n${pure.map(([name, fn]) => `const ${name}=(${fn.toString()});`).join('\n')}\nconst detectSignals=(${detectSignals.toString()});\nconst buildDebugPacket=(${buildDebugPacket.toString()});\nconst debugPacketMarkdown=(${debugPacketMarkdown.toString()});\nconst icons=${JSON.stringify(ICONS)};\ntry{${CORE_JS}${OVERVIEW_JS}${TESTS_JS}${PANEL_JS}${FAILURES_JS}${TRENDS_JS}${RUN_JS}${PROJECT_JS}\ninit()}catch(error){const banner=document.getElementById('lb-error');banner.hidden=false;banner.textContent='Report could not load: '+String(error)}})();`;
}
