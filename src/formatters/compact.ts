import { AnalyzedPage, AnalyzedPair, VariableIssue } from '../scanner/types';
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

function renderVariableIssue(issue: VariableIssue, idx: number): string {
  const lines: string[] = [];
  const threshold = issue.property === 'color' ? '4.5' : '4.5';
  const label = 'AA';

  lines.push(
    `[VAR #${idx + 1}] ${issue.variable} (${issue.property}) on ${issue.againstVariable || 'raw color'}`
  );
  lines.push(
    `         ${issue.currentHex} on ${issue.againstHex} = ${issue.contrastRatio.toFixed(2)}:1 (${label} requires ${threshold}:1)`
  );
  lines.push(`         Affects ${issue.affectedCount} element${issue.affectedCount > 1 ? 's' : ''}`);

  if (issue.suggestedFix) {
    lines.push(
      `         fix: change ${issue.suggestedFix.variable} to ${issue.suggestedFix.newValue} (${issue.suggestedFix.contrastRatio.toFixed(2)}:1)`
    );
  }

  return lines.join('\n');
}

function renderOneOff(v: AnalyzedPair, idx: number): string {
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

  // Design System Issues
  if (page.variableIssues.length > 0) {
    lines.push(`Design System Issues (${page.variableIssues.length} variable${page.variableIssues.length > 1 ? 's' : ''} → ${page.variableStats.affectedElements} element${page.variableStats.affectedElements > 1 ? 's' : ''})`);
    lines.push('');
    page.variableIssues.forEach((issue, i) => {
      lines.push(renderVariableIssue(issue, i));
      lines.push('');
    });
  }

  // One-off Issues
  const oneOffs = page.violations.filter((v) => !v.colorVar && !v.bgVar);
  if (oneOffs.length > 0) {
    lines.push(`One-off Issues (${oneOffs.length} element${oneOffs.length > 1 ? 's' : ''})`);
    lines.push('');
    oneOffs.forEach((v, i) => {
      lines.push(renderOneOff(v, i));
      lines.push('');
    });
  }

  return lines.join('\n');
}

export const compactFormatter: Formatter = {
  format(pages: AnalyzedPage[], _options?: FormatterOptions): FormatterResult {
    const totalViolations = pages.reduce((sum, p) => sum + p.violations.length, 0);
    const totalChecked = pages.reduce((sum, p) => sum + p.stats.total, 0);
    const totalVariableIssues = pages.reduce((sum, p) => sum + p.variableIssues.length, 0);

    const lines: string[] = [];

    if (totalViolations === 0) {
      lines.push(`✓ No contrast violations found (${totalChecked} elements checked)`);
      return { content: lines.join('\n'), exitCode: 0 };
    }

    lines.push(`${totalViolations} CONTRAST VIOLATION${totalViolations > 1 ? 'S' : ''} FOUND (${totalChecked} elements checked)`);
    if (totalVariableIssues > 0) {
      lines.push(`${totalVariableIssues} design system variable issue${totalVariableIssues > 1 ? 's' : ''} identified`);
    }
    lines.push('');

    pages.forEach((page) => {
      lines.push(renderPage(page));
    });

    return { content: lines.join('\n'), exitCode: 1 };
  },
};
