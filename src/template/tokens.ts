const light = {
  bg: '#f6f7fa', surface: '#ffffff', 'surface-2': '#f1f3f7', border: '#e1e5ec', text: '#171b26', muted: '#626d7d', accent: '#4e5fd0', 'accent-contrast': '#ffffff', passed: '#187354', failed: '#bd3844', flaky: '#96600d', skipped: '#626d7d', info: '#286d9b', 'passed-bg': 'rgba(24,115,84,.09)', 'failed-bg': 'rgba(189,56,68,.09)', 'flaky-bg': 'rgba(150,96,13,.10)', 'skipped-bg': 'rgba(98,109,125,.09)', 'code-bg': '#f7f8fa', shadow: '0 12px 32px rgba(20,29,48,.08)',
};
const dark = {
  bg: '#0d1119', surface: '#131a25', 'surface-2': '#1b2432', border: '#2b3748', text: '#edf1f7', muted: '#a1adbd', accent: '#a5b2ff', 'accent-contrast': '#111522', passed: '#63c49a', failed: '#ff858b', flaky: '#eac071', skipped: '#a1adbd', info: '#83c4e0', 'passed-bg': 'rgba(99,196,154,.14)', 'failed-bg': 'rgba(255,133,139,.14)', 'flaky-bg': 'rgba(234,192,113,.14)', 'skipped-bg': 'rgba(161,173,189,.14)', 'code-bg': '#0b1017', shadow: '0 12px 32px rgba(0,0,0,.3)',
};

export const TOKENS = {
  light, dark,
  ivoryLight: {
    ...light, bg: '#f5f0e7', surface: '#fffdf8', 'surface-2': '#f0e9dd', border: '#d8cdbd', text: '#292620', muted: '#675f55', accent: '#674696', passed: '#176b50', failed: '#b33440', flaky: '#8e5700', skipped: '#675f55', info: '#285f89', 'passed-bg': 'rgba(23,107,80,.10)', 'failed-bg': 'rgba(179,52,64,.10)', 'flaky-bg': 'rgba(142,87,0,.10)', 'skipped-bg': 'rgba(103,95,85,.10)', 'code-bg': '#f5efe5', shadow: '0 12px 32px rgba(51,38,24,.10)',
  },
  ivoryDark: {
    ...dark, bg: '#171511', surface: '#211e19', 'surface-2': '#2d2922', border: '#51483d', text: '#f2ebdf', muted: '#c3b7a7', accent: '#c7a6f0', passed: '#80d4ad', failed: '#ff979c', flaky: '#f3c875', skipped: '#c3b7a7', info: '#99c9e5', 'passed-bg': 'rgba(128,212,173,.14)', 'failed-bg': 'rgba(255,151,156,.14)', 'flaky-bg': 'rgba(243,200,117,.14)', 'skipped-bg': 'rgba(195,183,167,.14)', 'code-bg': '#14120f', shadow: '0 12px 32px rgba(0,0,0,.35)',
  },
  githubLight: {
    ...light, bg: '#f6f8fa', surface: '#ffffff', 'surface-2': '#f6f8fa', border: '#d0d7de', text: '#1f2328', muted: '#59636e', accent: '#0969da', passed: '#1a7f37', failed: '#cf222e', flaky: '#8a5a00', skipped: '#59636e', info: '#0969da', 'passed-bg': 'rgba(26,127,55,.09)', 'failed-bg': 'rgba(207,34,46,.09)', 'flaky-bg': 'rgba(138,90,0,.10)', 'skipped-bg': 'rgba(89,99,110,.09)', 'code-bg': '#f6f8fa', shadow: '0 12px 32px rgba(31,35,40,.10)',
  },
  githubDark: {
    ...dark, bg: '#0d1117', surface: '#161b22', 'surface-2': '#21262d', border: '#3d444d', text: '#f0f6fc', muted: '#a7b0ba', accent: '#79c0ff', passed: '#7ee787', failed: '#ff8b82', flaky: '#e3b341', skipped: '#a7b0ba', info: '#79c0ff', 'passed-bg': 'rgba(126,231,135,.14)', 'failed-bg': 'rgba(255,139,130,.14)', 'flaky-bg': 'rgba(227,179,65,.14)', 'skipped-bg': 'rgba(167,176,186,.14)', 'code-bg': '#0d1117', shadow: '0 12px 32px rgba(0,0,0,.35)',
  },
} as const;

export function tokensToCss(theme: keyof typeof TOKENS): string {
  const base = theme.endsWith('Light') ? light : dark;
  return Object.entries(TOKENS[theme])
    .filter(([name, value]) => theme === 'light' || theme === 'dark' || base[name as keyof typeof base] !== value)
    .map(([name, value]) => `--${name}:${value};`).join('');
}
