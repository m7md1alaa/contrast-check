import { AnalyzedPage, AnalyzedPair } from '../scanner/types';
import { Formatter, FormatterOptions, FormatterResult } from './types';

function hex(c: { r: number; g: number; b: number } | null): string {
  if (!c) return 'unknown';
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function truncate(text: string, max: number): string {
  if (!text) return '(empty)';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function renderViolation(v: AnalyzedPair, idx: number): string {
  const lines: string[] = [];
  const threshold = v.isLargeText ? 3 : 4.5;
  const label = v.isLargeText ? 'AA Large' : 'AA';

  lines.push(
    `[FAIL #${idx + 1}] ${v.selector} · "${truncate(v.text, 50)}"`
  );
  lines.push(
    `         ${hex(v.fgParsed)} on ${hex(v.bgParsed)} = ${v.contrastRatio.toFixed(2)}:1 (${label} requires ${threshold}:1)`
  );

  if (v.suggestedFix) {
    const prop = v.suggestedFix.property || 'color';
    const oldVal = prop === 'background-color' ? hex(v.bgParsed) : hex(v.fgParsed);
    lines.push(
      `         fix: change ${prop} from ${oldVal} to ${v.suggestedFix.hex} (${v.suggestedFix.ratio.toFixed(2)}:1)`
    );
  }

  return lines.join('\n');
}

function renderPage(page: AnalyzedPage): string {
  const lines: string[] = [];
  const vCount = page.violations.length;

  if (vCount === 0) {
    lines.push(`✓ ${page.url} — no contrast issues`);
    return lines.join('\n');
  }

  lines.push(`${page.url}`);
  lines.push('━'.repeat(50));
  lines.push('');

  page.violations.forEach((v, i) => {
    lines.push(renderViolation(v, i));
    lines.push('');
  });

  return lines.join('\n');
}

export const compactFormatter: Formatter = {
  format(pages: AnalyzedPage[], _options?: FormatterOptions): FormatterResult {
    const totalViolations = pages.reduce((sum, p) => sum + p.violations.length, 0);
    const totalChecked = pages.reduce((sum, p) => sum + p.stats.total, 0);

    const lines: string[] = [];

    if (totalViolations === 0) {
      lines.push(`✓ No contrast violations found (${totalChecked} elements checked)`);
      return { content: lines.join('\n'), exitCode: 0 };
    }

    lines.push(`${totalViolations} CONTRAST VIOLATION${totalViolations > 1 ? 'S' : ''} FOUND (${totalChecked} elements checked)`);
    lines.push('');

    pages.forEach((page) => {
      lines.push(renderPage(page));
    });

    return { content: lines.join('\n'), exitCode: 1 };
  },
};
