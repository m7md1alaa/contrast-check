import { AnalyzedPage } from '../scanner/types';
import { generateReport } from '../report/generator';
import { Formatter, FormatterOptions, FormatterResult } from './types';
import { shouldCountAsViolation } from '../analyzer/severity';

function countThresholdViolations(pages: AnalyzedPage[], threshold: 'critical' | 'aa' | 'strict'): number {
  return pages.reduce((sum, p) => {
    // Use severity-aware counting when pairs are populated
    if (p.pairs.length > 0) {
      const pairViolations = p.pairs.filter((pair) =>
        shouldCountAsViolation(pair.severity, threshold)
      ).length;
      const varViolations = p.variableIssues.filter((issue) =>
        shouldCountAsViolation(issue.severity, threshold)
      ).length;
      return sum + pairViolations + varViolations;
    }
    // Fallback for backward compatibility with data that only has violations array
    return sum + p.violations.length;
  }, 0);
}

export const htmlFormatter: Formatter = {
  format(pages: AnalyzedPage[], options?: FormatterOptions): FormatterResult {
    const threshold = options?.threshold || 'aa';
    const html = generateReport(pages, threshold);
    const thresholdViolations = countThresholdViolations(pages, threshold);
    return {
      content: html,
      exitCode: thresholdViolations > 0 ? 1 : 0,
    };
  },
};
