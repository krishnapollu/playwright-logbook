import { expect, it } from 'vitest';
import { TOKENS } from '../src/template/tokens.js';

type Color = [number, number, number];
const rgb = (hex: string): Color => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)) as Color;
const composite = (value: string, surface: Color): Color => {
  if (value.startsWith('#')) return rgb(value);
  const channels = value.match(/[\d.]+/g)!.map(Number);
  return surface.map((base, at) => channels[at]! * channels[3]! + base * (1 - channels[3]!)) as Color;
};
const luminance = (color: Color): number => color.map((value) => {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, at) => sum + value * [0.2126, 0.7152, 0.0722][at]!, 0);
const ratio = (a: Color, b: Color): number => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
};

it('keeps report text and status pairs at WCAG AA contrast', () => {
  for (const theme of [TOKENS.light, TOKENS.dark]) {
    const surface = rgb(theme.surface);
    const pairs: [string, string][] = [['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['accent', 'surface'], ['accent-contrast', 'accent']];
    for (const status of ['passed', 'failed', 'flaky', 'skipped'] as const) pairs.push([status, 'surface'], [status, `${status}-bg`]);
    for (const [front, back] of pairs) {
      const foreground = composite(theme[front as keyof typeof theme], surface);
      const background = composite(theme[back as keyof typeof theme], surface);
      expect(ratio(foreground, background), `${front} on ${back}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});
