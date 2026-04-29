import { describe, test, expect } from 'vitest';
import { parseColor, rgbToHex, blend, isTransparent } from './color';

describe('parseColor', () => {
  test('returns null for empty string', () => {
    expect(parseColor('')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(parseColor('   ')).toBeNull();
  });

  test('returns transparent black for "transparent" keyword', () => {
    const result = parseColor('transparent');
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  test('returns null for invalid color string', () => {
    expect(parseColor('not-a-color')).toBeNull();
    expect(parseColor('rgb(invalid)')).toBeNull();
  });

  test('parses 6-digit hex', () => {
    const result = parseColor('#ff0000');
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  test('parses 3-digit hex shorthand', () => {
    const result = parseColor('#f0f');
    expect(result).toEqual({ r: 255, g: 0, b: 255, a: 1 });
  });

  test('parses rgb() string', () => {
    const result = parseColor('rgb(128, 64, 32)');
    expect(result).toEqual({ r: 128, g: 64, b: 32, a: 1 });
  });

  test('parses rgba() string with alpha', () => {
    const result = parseColor('rgba(255, 0, 0, 0.5)');
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 0.5 });
  });

  test('parses hsl() string', () => {
    const result = parseColor('hsl(0, 100%, 50%)');
    expect(result).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  test('parses named color "white"', () => {
    const result = parseColor('white');
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  test('parses named color "black"', () => {
    const result = parseColor('black');
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  test('clamps out-of-gamut values', () => {
    // culori clamps values that are out of sRGB gamut
    const result = parseColor('color(display-p3 1.2 0 0)');
    expect(result).not.toBeNull();
    expect(result!.r).toBe(255);
  });
});

describe('rgbToHex', () => {
  test('converts pure red to hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
  });

  test('converts pure green to hex', () => {
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
  });

  test('converts pure blue to hex', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
  });

  test('converts white to hex', () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  test('converts black to hex', () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  test('pads single-digit hex values with zero', () => {
    expect(rgbToHex({ r: 0, g: 15, b: 7 })).toBe('#000f07');
  });
});

describe('blend', () => {
  test('fully opaque foreground ignores background', () => {
    const result = blend(
      { r: 255, g: 0, b: 0, a: 1 },
      { r: 0, g: 0, b: 255, a: 1 }
    );
    expect(result).toEqual({ r: 255, g: 0, b: 0 });
  });

  test('fully transparent foreground returns background', () => {
    const result = blend(
      { r: 255, g: 0, b: 0, a: 0 },
      { r: 0, g: 0, b: 255, a: 1 }
    );
    expect(result).toEqual({ r: 0, g: 0, b: 255 });
  });

  test('50% alpha blends evenly', () => {
    const result = blend(
      { r: 255, g: 255, b: 255, a: 0.5 },
      { r: 0, g: 0, b: 0, a: 1 }
    );
    // White 50% on black = 128 (rounded)
    expect(result).toEqual({ r: 128, g: 128, b: 128 });
  });

  test('25% alpha blends correctly', () => {
    const result = blend(
      { r: 255, g: 0, b: 0, a: 0.25 },
      { r: 0, g: 0, b: 0, a: 1 }
    );
    // 255*0.25 + 0*0.75 = 63.75 → rounds to 64
    expect(result).toEqual({ r: 64, g: 0, b: 0 });
  });
});

describe('isTransparent', () => {
  test('returns true for alpha 0', () => {
    expect(isTransparent({ r: 255, g: 0, b: 0, a: 0 })).toBe(true);
  });

  test('returns false for alpha 1', () => {
    expect(isTransparent({ r: 0, g: 0, b: 0, a: 1 })).toBe(false);
  });

  test('returns false for partial alpha', () => {
    expect(isTransparent({ r: 0, g: 0, b: 0, a: 0.5 })).toBe(false);
  });
});
