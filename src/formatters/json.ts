import { AnalyzedPage } from '../scanner/types';
import { Formatter, FormatterOptions, FormatterResult } from './types';

export const jsonFormatter: Formatter = {
  format(pages: AnalyzedPage[], _options?: FormatterOptions): FormatterResult {
    const totalViolations = pages.reduce((sum, p) => sum + p.violations.length, 0);
    return {
      content: JSON.stringify(pages, null, 2),
      exitCode: totalViolations > 0 ? 1 : 0,
    };
  },
};
