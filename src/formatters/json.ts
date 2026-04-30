import { AnalyzedPage } from '../scanner/types';
import { Formatter, FormatterOptions, FormatterResult } from './types';
import { shouldCountAsViolation } from '../analyzer/severity';

function countThresholdViolations(pages: AnalyzedPage[], threshold: 'critical' | 'aa' | 'strict'): number {
  return pages.reduce((sum, p) => {
    if (p.pairs.length > 0) {
      const pairViolations = p.pairs.filter((pair) =>
        shouldCountAsViolation(pair.severity, threshold)
      ).length;
      const varViolations = p.variableIssues.filter((issue) =>
        shouldCountAsViolation(issue.severity, threshold)
      ).length;
      return sum + pairViolations + varViolations;
    }
    return sum + p.violations.length;
  }, 0);
}

export const jsonFormatter: Formatter = {
  format(pages: AnalyzedPage[], options?: FormatterOptions): FormatterResult {
    const threshold = options?.threshold || 'aa';
    const thresholdViolations = countThresholdViolations(pages, threshold);
    return {
      content: JSON.stringify(pages, null, 2),
      exitCode: thresholdViolations > 0 ? 1 : 0,
    };
  },
};
