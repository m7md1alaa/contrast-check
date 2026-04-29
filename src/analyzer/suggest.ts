import { converter, clampRgb, parse as culoriParse } from 'culori';
import { RGBA, rgbToHex, formatColorPreservingMode } from './color';
import { calculateContrast } from './contrast';

const toOklch = converter('oklch');
const toRgb = converter('rgb');

function rgbaToOklch(c: RGBA) {
  const result = toOklch({
    mode: 'rgb',
    r: c.r / 255,
    g: c.g / 255,
    b: c.b / 255,
    alpha: c.a,
  });
  if (!result || Number.isNaN(result.l)) return null;
  return result;
}

function oklchToRgba(oklch: any): RGBA {
  const rgb = toRgb(oklch);
  const clamped = clampRgb(rgb);
  return {
    r: Math.round(clamped.r * 255),
    g: Math.round(clamped.g * 255),
    b: Math.round(clamped.b * 255),
    a: clamped.alpha ?? 1,
  };
}

/** Perceptual distance in Oklch space (Euclidean in LCh is fine for ranking) */
function oklchDistance(a: any, b: any): number {
  return Math.sqrt(
    Math.pow(a.l - b.l, 2) +
    Math.pow(a.c - b.c, 2) +
    Math.pow((a.h ?? 0) - (b.h ?? 0), 2)
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
  const originalOklch = rgbaToOklch(original);
  if (!originalOklch) return null;

  let best: SuggestedFix | null = null;

  // Scan lightness L from 0 to 1 in fine steps
  // Oklch L is perceptually uniform: 0 = black, 1 = white
  for (let l = 0; l <= 1; l += 0.005) {
    const candidateOklch = { ...originalOklch, l };
    const candidateRgb = oklchToRgba(candidateOklch);

    const ratio =
      property === 'color'
        ? calculateContrast(candidateRgb, fixedBg).ratio
        : calculateContrast(fixedBg, candidateRgb).ratio;

    if (ratio >= targetRatio) {
      const deltaE = oklchDistance(originalOklch, candidateOklch);
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

export interface VariableSuggestedFix {
  variable: string;
  newValue: string;
  newHex: string;
  contrastRatio: number;
  property: 'color' | 'background-color';
}

/**
 * Suggest a fix for a CSS variable while preserving its original color format.
 * Uses Oklch for perceptual lightness adjustment while keeping chroma + hue.
 */
export function suggestVariableFix(
  fg: RGBA,
  bg: RGBA,
  targetRatio: number,
  variableRawValue: string,
  variableName: string,
  property: 'color' | 'background-color'
): VariableSuggestedFix | null {
  const parsed = culoriParse(variableRawValue);
  if (!parsed) return null;

  const originalOklch = toOklch(parsed);
  if (!originalOklch || Number.isNaN(originalOklch.l)) return null;

  const otherColor = property === 'color' ? bg : fg;

  let best: { oklch: any; ratio: number; deltaE: number } | null = null;

  for (let l = 0; l <= 1; l += 0.005) {
    const candidateOklch = { ...originalOklch, l };
    const candidateRgb = oklchToRgba(candidateOklch);

    const ratio =
      property === 'color'
        ? calculateContrast(candidateRgb, otherColor).ratio
        : calculateContrast(otherColor, candidateRgb).ratio;

    if (ratio >= targetRatio) {
      const deltaE = oklchDistance(originalOklch, candidateOklch);
      if (!best || deltaE < best.deltaE) {
        best = { oklch: candidateOklch, ratio, deltaE };
      }
    }
  }

  if (!best) return null;

  // Convert back to the original color mode
  const toOriginal = converter(parsed.mode);
  const adjusted = toOriginal(best.oklch);
  if (!adjusted) return null;

  // Preserve original alpha
  if (parsed.alpha !== undefined && parsed.alpha !== null) {
    (adjusted as any).alpha = parsed.alpha;
  }

  const { css, hex } = formatColorPreservingMode(adjusted);

  return {
    variable: variableName,
    newValue: css,
    newHex: hex,
    contrastRatio: best.ratio,
    property,
  };
}
