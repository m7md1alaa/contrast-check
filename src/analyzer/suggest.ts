import { RGBA, rgbToHex } from './color.js';
import { calculateContrast, ContrastResult } from './contrast.js';

export function suggestFix(
  fg: RGBA,
  bg: RGBA,
  targetRatio: number
): { color: RGBA; hex: string; ratio: number } | null {
  // Simple approach: try lightening/darkening the foreground color
  // by adjusting brightness in HSL space
  const candidates: RGBA[] = [];

  for (let direction of [-1, 1]) {
    for (let step = 1; step <= 20; step++) {
      const factor = 1 + direction * step * 0.05;
      const candidate: RGBA = {
        r: Math.min(255, Math.max(0, Math.round(fg.r * factor))),
        g: Math.min(255, Math.max(0, Math.round(fg.g * factor))),
        b: Math.min(255, Math.max(0, Math.round(fg.b * factor))),
        a: fg.a,
      };
      candidates.push(candidate);
    }
  }

  let best: { color: RGBA; ratio: number } | null = null;

  for (const candidate of candidates) {
    const result = calculateContrast(candidate, bg);
    if (result.ratio >= targetRatio) {
      if (!best || result.ratio < best.ratio) {
        best = { color: candidate, ratio: result.ratio };
      }
    }
  }

  if (best) {
    return {
      color: best.color,
      hex: rgbToHex(best.color),
      ratio: best.ratio,
    };
  }

  return null;
}
