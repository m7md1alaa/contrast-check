import { describe, test, expect } from 'vitest';
import {
  getSeverity,
  calculateHealthScore,
  shouldCountAsViolation,
  type Severity,
  type SeverityThreshold,
} from './severity';

describe('getSeverity', () => {
  describe('normal text', () => {
    test('ratio below 3.0 is critical', () => {
      expect(getSeverity(2.5, false)).toBe('critical');
      expect(getSeverity(1.0, false)).toBe('critical');
      expect(getSeverity(2.99, false)).toBe('critical');
    });

    test('ratio 3.0 to 4.49 is warning', () => {
      expect(getSeverity(3.0, false)).toBe('warning');
      expect(getSeverity(4.0, false)).toBe('warning');
      expect(getSeverity(4.49, false)).toBe('warning');
    });

    test('ratio 4.5 to 6.99 is fine', () => {
      expect(getSeverity(4.5, false)).toBe('fine');
      expect(getSeverity(5.0, false)).toBe('fine');
      expect(getSeverity(6.99, false)).toBe('fine');
    });

    test('ratio 7.0 and above is excellent', () => {
      expect(getSeverity(7.0, false)).toBe('excellent');
      expect(getSeverity(10.0, false)).toBe('excellent');
      expect(getSeverity(21.0, false)).toBe('excellent');
    });
  });

  describe('large text', () => {
    test('ratio below 3.0 is critical', () => {
      expect(getSeverity(2.5, true)).toBe('critical');
      expect(getSeverity(1.0, true)).toBe('critical');
    });

    test('ratio 3.0 to 4.49 is warning', () => {
      expect(getSeverity(3.0, true)).toBe('warning');
      expect(getSeverity(4.0, true)).toBe('warning');
      expect(getSeverity(4.49, true)).toBe('warning');
    });

    test('ratio 4.5 to 6.99 is fine', () => {
      expect(getSeverity(4.5, true)).toBe('fine');
      expect(getSeverity(6.0, true)).toBe('fine');
    });

    test('ratio 7.0 and above is excellent', () => {
      expect(getSeverity(7.0, true)).toBe('excellent');
      expect(getSeverity(21.0, true)).toBe('excellent');
    });
  });
});

describe('calculateHealthScore', () => {
  test('100% when all elements are fine or excellent', () => {
    const pairs = [
      { contrastRatio: 4.5, isLargeText: false },
      { contrastRatio: 7.0, isLargeText: false },
      { contrastRatio: 5.0, isLargeText: true },
    ];
    expect(calculateHealthScore(pairs)).toBe(100);
  });

  test('0% when all elements are critical', () => {
    const pairs = [
      { contrastRatio: 1.5, isLargeText: false },
      { contrastRatio: 2.0, isLargeText: true },
    ];
    expect(calculateHealthScore(pairs)).toBe(0);
  });

  test('50% when half are fine and half are warning', () => {
    const pairs = [
      { contrastRatio: 4.5, isLargeText: false },
      { contrastRatio: 3.5, isLargeText: false },
    ];
    expect(calculateHealthScore(pairs)).toBe(50);
  });

  test('0% for empty array', () => {
    expect(calculateHealthScore([])).toBe(0);
  });

  test('rounds to nearest integer', () => {
    const pairs = [
      { contrastRatio: 4.5, isLargeText: false },
      { contrastRatio: 4.5, isLargeText: false },
      { contrastRatio: 3.5, isLargeText: false },
    ];
    expect(calculateHealthScore(pairs)).toBe(67);
  });
});

describe('shouldCountAsViolation', () => {
  const thresholds: SeverityThreshold[] = ['critical', 'aa', 'strict'];

  describe('critical threshold', () => {
    const t: SeverityThreshold = 'critical';

    test('only counts critical as violation', () => {
      expect(shouldCountAsViolation('critical', t)).toBe(true);
      expect(shouldCountAsViolation('warning', t)).toBe(false);
      expect(shouldCountAsViolation('fine', t)).toBe(false);
      expect(shouldCountAsViolation('excellent', t)).toBe(false);
    });
  });

  describe('aa threshold (default)', () => {
    const t: SeverityThreshold = 'aa';

    test('counts critical and warning as violations', () => {
      expect(shouldCountAsViolation('critical', t)).toBe(true);
      expect(shouldCountAsViolation('warning', t)).toBe(true);
      expect(shouldCountAsViolation('fine', t)).toBe(false);
      expect(shouldCountAsViolation('excellent', t)).toBe(false);
    });
  });

  describe('strict threshold', () => {
    const t: SeverityThreshold = 'strict';

    test('counts everything below excellent as violation', () => {
      expect(shouldCountAsViolation('critical', t)).toBe(true);
      expect(shouldCountAsViolation('warning', t)).toBe(true);
      expect(shouldCountAsViolation('fine', t)).toBe(true);
      expect(shouldCountAsViolation('excellent', t)).toBe(false);
    });
  });
});
