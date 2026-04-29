import { RGBA, blend } from './color.js';

export interface ContrastResult {
  ratio: number;
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
  aaaLarge: boolean;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function calculateContrast(
  fg: RGBA,
  bg: RGBA
): ContrastResult {
  // Blend against opaque background if either has transparency
  let finalFg = fg;
  let finalBg = bg;

  if (fg.a < 1 && bg.a === 1) {
    finalFg = { ...blend(fg, bg), a: 1 };
  } else if (bg.a < 1 && fg.a === 1) {
    finalBg = { ...blend(bg, { r: 255, g: 255, b: 255, a: 1 }), a: 1 };
  } else if (fg.a < 1 && bg.a < 1) {
    // Both transparent: assume white page background behind bg
    const opaqueBg = { ...blend(bg, { r: 255, g: 255, b: 255, a: 1 }), a: 1 };
    finalFg = { ...blend(fg, opaqueBg), a: 1 };
    finalBg = opaqueBg;
  }

  const lum1 = relativeLuminance(finalFg.r, finalFg.g, finalFg.b);
  const lum2 = relativeLuminance(finalBg.r, finalBg.g, finalBg.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return {
    ratio: Math.round(ratio * 100) / 100,
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
  };
}
