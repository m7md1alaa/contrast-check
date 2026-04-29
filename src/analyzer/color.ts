import {
  parse,
  converter,
  formatCss,
  formatHex,
  Rgba,
  Rgb,
  clampRgb,
} from 'culori';

const toRgb = converter('rgb');

export interface RGBA {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export function parseColor(colorStr: string): RGBA | null {
  if (!colorStr) return null;
  if (colorStr === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  try {
    const parsed = parse(colorStr);
    if (!parsed) return null;

    const rgb = toRgb(parsed);
    if (!rgb) return null;

    const clamped = clampRgb(rgb);
    return {
      r: Math.round(clamped.r * 255),
      g: Math.round(clamped.g * 255),
      b: Math.round(clamped.b * 255),
      a: clamped.alpha ?? 1,
    };
  } catch {
    return null;
  }
}

export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function blend(fg: RGBA, bg: RGBA): { r: number; g: number; b: number } {
  const a = fg.a;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
}

export function isTransparent(color: RGBA): boolean {
  return color.a === 0;
}

/**
 * Round numeric values inside a CSS color function string to a sane precision.
 * e.g. oklch(0.5646550625783017 0.08000126639875797 180.53331328594822)
 *   -> oklch(0.565 0.08 180.533)
 */
function roundCssNumbers(css: string): string {
  return css.replace(/-?\d+\.\d+/g, (match) => {
    const n = parseFloat(match);
    // For angles (0-360), keep 1 decimal. For others, keep 3 decimals.
    const isAngle = n > 100 && n <= 360 && css.includes('oklch');
    const rounded = isAngle ? Math.round(n * 10) / 10 : Math.round(n * 1000) / 1000;
    return rounded.toString();
  });
}

/**
 * Format a culori color object back to CSS using the same color mode as the original.
 * Falls back to hex if formatCss fails.
 */
export function formatColorPreservingMode(color: any): { css: string; hex: string } {
  let css: string;
  try {
    css = formatCss(color);
    css = roundCssNumbers(css);
  } catch {
    const rgb = toRgb(color);
    css = rgb ? `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})` : 'black';
  }
  let hex: string;
  try {
    hex = formatHex(color) || rgbToHex({
      r: Math.round((toRgb(color)?.r ?? 0) * 255),
      g: Math.round((toRgb(color)?.g ?? 0) * 255),
      b: Math.round((toRgb(color)?.b ?? 0) * 255),
    });
  } catch {
    hex = '#000000';
  }
  return { css, hex };
}
