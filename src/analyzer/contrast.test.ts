import { describe, test, expect } from 'vitest';
import { calculateContrast } from './contrast';
import { RGBA } from './color';

function c(r: number, g: number, b: number, a = 1): RGBA {
  return { r, g, b, a };
}

describe('calculateContrast', () => {
  describe('known WCAG reference values', () => {
    test('black on white has ratio 21', () => {
      const result = calculateContrast(c(0, 0, 0), c(255, 255, 255));
      expect(result.ratio).toBe(21);
      expect(result.aa).toBe(true);
      expect(result.aaa).toBe(true);
      expect(result.aaLarge).toBe(true);
      expect(result.aaaLarge).toBe(true);
    });

    test('white on black has ratio 21', () => {
      const result = calculateContrast(c(255, 255, 255), c(0, 0, 0));
      expect(result.ratio).toBe(21);
    });

    test('same color has ratio 1', () => {
      const result = calculateContrast(c(128, 128, 128), c(128, 128, 128));
      expect(result.ratio).toBe(1);
      expect(result.aa).toBe(false);
      expect(result.aaa).toBe(false);
      expect(result.aaLarge).toBe(false);
      expect(result.aaaLarge).toBe(false);
    });

    test('red on white has ratio 4.0 (fails AA normal)', () => {
      const result = calculateContrast(c(255, 0, 0), c(255, 255, 255));
      expect(result.ratio).toBe(4);
      expect(result.aa).toBe(false);
      expect(result.aaa).toBe(false);
      expect(result.aaLarge).toBe(true);
      expect(result.aaaLarge).toBe(false);
    });

    test('blue on white has ratio 8.59 (passes AA)', () => {
      const result = calculateContrast(c(0, 0, 255), c(255, 255, 255));
      expect(result.ratio).toBe(8.59);
      expect(result.aa).toBe(true);
      expect(result.aaa).toBe(true);
    });

    test('green on white has ratio ~1.37 (fails everything)', () => {
      const result = calculateContrast(c(0, 255, 0), c(255, 255, 255));
      expect(result.ratio).toBeCloseTo(1.37, 2);
      expect(result.aa).toBe(false);
      expect(result.aaLarge).toBe(false);
    });
  });

  describe('WCAG threshold boundaries', () => {
    test('ratio 4.5 exactly passes AA normal', () => {
      // #767676 on white ≈ 4.5:1
      const result = calculateContrast(c(118, 118, 118), c(255, 255, 255));
      expect(result.ratio).toBeCloseTo(4.5, 1);
      expect(result.aa).toBe(true);
    });

    test('ratio just below 4.5 fails AA normal', () => {
      // #777777 on white ≈ 4.48:1
      const result = calculateContrast(c(119, 119, 119), c(255, 255, 255));
      expect(result.ratio).toBeLessThan(4.5);
      expect(result.aa).toBe(false);
    });

    test('ratio 3.0 exactly passes AA large', () => {
      // #949494 on white ≈ 3.0:1
      const result = calculateContrast(c(148, 148, 148), c(255, 255, 255));
      expect(result.ratio).toBeCloseTo(3.0, 1);
      expect(result.aaLarge).toBe(true);
    });

    test('ratio 7.0 exactly passes AAA normal', () => {
      // #595959 on white ≈ 7.0:1
      const result = calculateContrast(c(89, 89, 89), c(255, 255, 255));
      expect(result.ratio).toBeCloseTo(7.0, 1);
      expect(result.aaa).toBe(true);
    });

    test('ratio 4.5 exactly passes AAA large', () => {
      const result = calculateContrast(c(118, 118, 118), c(255, 255, 255));
      expect(result.aaaLarge).toBe(true);
    });
  });

  describe('transparency handling', () => {
    test('semi-transparent foreground blends with opaque background', () => {
      // 50% black on white should blend to gray
      const result = calculateContrast(c(0, 0, 0, 0.5), c(255, 255, 255));
      // Blended: 127.5, 127.5, 127.5
      expect(result.ratio).toBeCloseTo(3.94, 1);
    });

    test('opaque foreground with semi-transparent background blends on white', () => {
      // black on 50% white (transparent bg) -> bg blends to white + gray = lighter gray
      const result = calculateContrast(c(0, 0, 0, 1), c(255, 255, 255, 0.5));
      // bg blended: 255*0.5 + 255*0.5 = 255? No wait, blend(bg, white) where bg is 50% white on white
      // bg is rgba(255,255,255,0.5), blended on white = 255,255,255
      // Actually the code blends bg with white: rgba(255,255,255,0.5) on white = white
      expect(result.ratio).toBe(21);
    });

    test('both semi-transparent blends through white page background', () => {
      const result = calculateContrast(c(0, 0, 0, 0.5), c(255, 255, 255, 0.5));
      // bg blends to white, fg blends to gray on white
      expect(result.ratio).toBeCloseTo(3.94, 1);
    });

    test('fully transparent foreground is treated as blended', () => {
      const result = calculateContrast(c(0, 0, 0, 0), c(255, 255, 255));
      // Fully transparent fg on white bg = white
      expect(result.ratio).toBe(1);
    });
  });

  describe('edge cases', () => {
    test('pure red on pure green', () => {
      const result = calculateContrast(c(255, 0, 0), c(0, 255, 0));
      expect(result.ratio).toBeCloseTo(2.91, 2);
    });

    test('dark gray on black has ratio 2.03', () => {
      const result = calculateContrast(c(64, 64, 64), c(0, 0, 0));
      expect(result.ratio).toBe(2.03);
    });

    test('ratios are rounded to 2 decimal places', () => {
      const result = calculateContrast(c(0, 0, 0), c(255, 255, 255));
      expect(result.ratio).toBe(21);
      expect(result.ratio).not.toBe(21.0000001);
    });
  });
});
