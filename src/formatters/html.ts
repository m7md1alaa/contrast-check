import { AnalyzedPage } from '../scanner/types';
import { generateReport } from '../report/generator';
import { Formatter, FormatterOptions, FormatterResult } from './types';

export const htmlFormatter: Formatter = {
  format(pages: AnalyzedPage[], options?: FormatterOptions): FormatterResult {
    const html = generateReport(pages);
    const totalViolations = pages.reduce((sum, p) => sum + p.violations.length, 0);
    return {
      content: html,
      exitCode: totalViolations > 0 ? 1 : 0,
    };
  },
};
