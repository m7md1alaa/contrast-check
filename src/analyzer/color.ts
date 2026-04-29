import {
  parse,
  converter,
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
  if (!colorStr || colorStr === 'transparent') {
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
