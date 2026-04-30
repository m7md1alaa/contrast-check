import { AnalyzedPage } from '../scanner/types';

export type OutputFormat = 'html' | 'json' | 'compact';

export interface FormatterOptions {
  outputPath?: string;
  quiet?: boolean;
  threshold?: 'critical' | 'aa' | 'strict';
}

export interface FormatterResult {
  content: string;
  exitCode: number;
}

export interface Formatter {
  format(pages: AnalyzedPage[], options?: FormatterOptions): FormatterResult;
}
