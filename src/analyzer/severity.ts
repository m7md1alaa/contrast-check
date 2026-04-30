export type Severity = 'critical' | 'warning' | 'fine' | 'excellent';
export type SeverityThreshold = 'critical' | 'aa' | 'strict';

export function getSeverity(ratio: number, isLargeText: boolean): Severity {
  if (ratio < 3) return 'critical';
  if (ratio < 4.5) return 'warning';
  if (ratio < 7) return 'fine';
  return 'excellent';
}

export function calculateHealthScore(
  pairs: Array<{ contrastRatio: number; isLargeText: boolean }>
): number {
  if (pairs.length === 0) return 0;

  const passing = pairs.filter((p) => {
    const severity = getSeverity(p.contrastRatio, p.isLargeText);
    return severity === 'fine' || severity === 'excellent';
  }).length;

  return Math.round((passing / pairs.length) * 100);
}

export function shouldCountAsViolation(
  severity: Severity,
  threshold: SeverityThreshold
): boolean {
  const order: Record<Severity, number> = {
    critical: 0,
    warning: 1,
    fine: 2,
    excellent: 3,
  };

  const thresholdOrder: Record<SeverityThreshold, number> = {
    critical: 0,
    aa: 1,
    strict: 2,
  };

  return order[severity] <= thresholdOrder[threshold];
}
