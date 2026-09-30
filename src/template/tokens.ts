export const TOKENS = {
  dark: {
    bg: '#0b1020', surface: '#121a2e', 'surface-2': '#1a2440', border: '#2a3656', text: '#e8edf8', muted: '#aab7d4', accent: '#8ba7ff', 'accent-contrast': '#0b1020', passed: '#3ecf8e', failed: '#ff777e', flaky: '#ffc06e', skipped: '#aab7d4', info: '#6cc4ff', 'passed-bg': 'rgba(62,207,142,.14)', 'failed-bg': 'rgba(255,107,114,.14)', 'flaky-bg': 'rgba(255,180,84,.14)', 'skipped-bg': 'rgba(154,167,199,.14)', 'code-bg': '#0a0f1d', shadow: '0 8px 24px rgba(0,0,0,.35)',
  },
  light: {
    bg: '#f4f6fb', surface: '#ffffff', 'surface-2': '#eef2fa', border: '#d8deec', text: '#131a2c', muted: '#56627f', accent: '#3954e6', 'accent-contrast': '#ffffff', passed: '#0b7a4f', failed: '#c62f3a', flaky: '#895000', skipped: '#56627f', info: '#0b6fa8', 'passed-bg': 'rgba(11,122,79,.10)', 'failed-bg': 'rgba(198,47,58,.10)', 'flaky-bg': 'rgba(154,91,0,.10)', 'skipped-bg': 'rgba(86,98,127,.10)', 'code-bg': '#f7f9fd', shadow: '0 6px 20px rgba(20,30,60,.10)',
  },
} as const;

export function tokensToCss(theme: keyof typeof TOKENS): string {
  return Object.entries(TOKENS[theme]).map(([name, value]) => `--${name}:${value};`).join('');
}
