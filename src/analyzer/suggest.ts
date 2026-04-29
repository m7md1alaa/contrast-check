import { converter, clampRgb } from 'culori';
import { RGBA, rgbToHex } from './color';
import { calculateContrast } from './contrast';

const toLab = converter('lab');
const toRgb = converter('rgb');

interface LabColor {
  mode: 'lab';
  l: number;
  a: number;
  b: number;
  alpha?: number;
}

function rgbaToLab(c: RGBA): LabColor | null {
  const result = toLab({
    mode: 'rgb',
    r: c.r / 255,
    g: c.g / 255,
    b: c.b / 255,
    alpha: c.a,
  });
  if (!result || Number.isNaN((result as any).l)) return null;
  return result as unknown as LabColor;
}

function labToRgba(lab: any): RGBA {
  const rgb = toRgb(lab);
  const clamped = clampRgb(rgb);
  return {
    r: Math.round(clamped.r * 255),
    g: Math.round(clamped.g * 255),
    b: Math.round(clamped.b * 255),
    a: clamped.alpha ?? 1,
  };
}

/** Euclidean distance in LAB space (simpler perceptual metric) */
function labDistance(lab1: any, lab2: any): number {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

export interface SuggestedFix {
  color: RGBA;
  hex: string;
  ratio: number;
  /** Which CSS property to change */
  property: 'color' | 'background-color';
  /** Perceptual distance from original (lower = closer match) */
  deltaE: number;
}

function generateLightnessCandidates(
  original: RGBA,
  fixedBg: RGBA,
  targetRatio: number,
  property: 'color' | 'background-color'
): SuggestedFix | null {
  const originalLab = rgbaToLab(original);
  if (!originalLab || Number.isNaN(originalLab.l)) return null;

  let best: SuggestedFix | null = null;

  // Scan lightness from 0 to 100 in steps of 1
  for (let l = 0; l <= 100; l += 1) {
    const candidateLab = { mode: 'lab', l, a: originalLab.a, b: originalLab.b };
    const candidateRgb = labToRgba(candidateLab);

    const ratio =
      property === 'color'
        ? calculateContrast(candidateRgb, fixedBg).ratio
        : calculateContrast(fixedBg, candidateRgb).ratio;

    if (ratio >= targetRatio) {
      const deltaE = labDistance(originalLab, candidateLab);
      if (!best || deltaE < best.deltaE) {
        best = {
          color: candidateRgb,
          hex: rgbToHex(candidateRgb),
          ratio,
          property,
          deltaE,
        };
      }
    }
  }

  return best;
}

/**
 * Suggest the smallest perceptual change to either the foreground or
 * background color to meet the target contrast ratio.
 */
export function suggestFix(
  fg: RGBA,
  bg: RGBA,
  targetRatio: number
): SuggestedFix | null {
  // Try adjusting foreground
  const fgFix = generateLightnessCandidates(fg, bg, targetRatio, 'color');

  // Try adjusting background
  const bgFix = generateLightnessCandidates(bg, fg, targetRatio, 'background-color');

  // Pick the one with the smallest perceptual change
  if (fgFix && bgFix) {
    return fgFix.deltaE <= bgFix.deltaE ? fgFix : bgFix;
  }
  return fgFix || bgFix || null;
}
