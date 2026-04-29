import { OutputFormat, Formatter } from './types';
import { compactFormatter } from './compact';
import { jsonFormatter } from './json';
import { htmlFormatter } from './html';

const formatters: Record<OutputFormat, Formatter> = {
  compact: compactFormatter,
  json: jsonFormatter,
  html: htmlFormatter,
};

export function getFormatter(format: string): Formatter {
  const f = formatters[format as OutputFormat];
  if (!f) {
    throw new Error(
      `Unknown format: ${format}. Supported: ${Object.keys(formatters).join(', ')}`
    );
  }
  return f;
}

export type { OutputFormat };
