export const TOKENS = {
  dark: {
    bg: '#0d1119', surface: '#131a25', 'surface-2': '#1b2432', border: '#2b3748', text: '#edf1f7', muted: '#a1adbd', accent: '#a5b2ff', 'accent-contrast': '#111522', passed: '#63c49a', failed: '#ff858b', flaky: '#eac071', skipped: '#a1adbd', info: '#83c4e0', 'passed-bg': 'rgba(99,196,154,.14)', 'failed-bg': 'rgba(255,133,139,.14)', 'flaky-bg': 'rgba(234,192,113,.14)', 'skipped-bg': 'rgba(161,173,189,.14)', 'code-bg': '#0b1017', shadow: '0 12px 32px rgba(0,0,0,.3)',
  },
  light: {
    bg: '#f6f7fa', surface: '#ffffff', 'surface-2': '#f1f3f7', border: '#e1e5ec', text: '#171b26', muted: '#626d7d', accent: '#4e5fd0', 'accent-contrast': '#ffffff', passed: '#187354', failed: '#bd3844', flaky: '#96600d', skipped: '#626d7d', info: '#286d9b', 'passed-bg': 'rgba(24,115,84,.09)', 'failed-bg': 'rgba(189,56,68,.09)', 'flaky-bg': 'rgba(150,96,13,.10)', 'skipped-bg': 'rgba(98,109,125,.09)', 'code-bg': '#f7f8fa', shadow: '0 12px 32px rgba(20,29,48,.08)',
  },
} as const;

export function tokensToCss(theme: keyof typeof TOKENS): string {
  return Object.entries(TOKENS[theme]).map(([name, value]) => `--${name}:${value};`).join('');
}
