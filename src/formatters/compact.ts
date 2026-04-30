import { AnalyzedPage, AnalyzedPair, VariableIssue } from '../scanner/types';
import { Formatter, FormatterOptions, FormatterResult } from './types';
import { shouldCountAsViolation, calculateHealthScore } from '../analyzer/severity';

function hex(c: { r: number; g: number; b: number } | null): string {
  if (!c) return 'unknown';
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

function truncate(text: string, max: number): string {
  if (!text) return '(empty)';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function severityLabel(severity: string | undefined): string {
  const labels: Record<string, string> = {
    critical: 'CRITICAL',
    warning: 'WARNING',
    fine: 'FINE',
    excellent: 'EXCELLENT',
  };
  return labels[severity || ''] || (severity || 'UNKNOWN').toUpperCase();
}

function renderVariableIssue(issue: VariableIssue, idx: number): string {
  const lines: string[] = [];
  const threshold = issue.property === 'color' ? '4.5' : '4.5';
  const label = 'AA';
  const sev = severityLabel(issue.severity);

  lines.push(
    `[VAR #${idx + 1}] [${sev}] ${issue.variable} (${issue.property}) on ${issue.againstVariable || 'raw color'}`
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
  const sev = severityLabel(v.severity);

  lines.push(
    `[${sev} #${idx + 1}] ${v.selector} · "${truncate(v.text, 50)}"`
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
  format(pages: AnalyzedPage[], options?: FormatterOptions): FormatterResult {
    const threshold = options?.threshold || 'aa';
    const totalChecked = pages.reduce((sum, p) => sum + p.stats.total, 0);
    const totalVariableIssues = pages.reduce((sum, p) => sum + p.variableIssues.length, 0);

    // Count threshold-based violations across all pages
    const thresholdViolations = pages.reduce((sum, p) => {
      if (p.pairs.length > 0) {
        const pairViolations = p.pairs.filter((pair) => shouldCountAsViolation(pair.severity, threshold)).length;
        const varViolations = p.variableIssues.filter((issue) => shouldCountAsViolation(issue.severity, threshold)).length;
        return sum + pairViolations + varViolations;
      }
      return sum + p.violations.length;
    }, 0);

    // Compute health score from pairs if available, otherwise use stored value
    const avgHealthScore = pages.length > 0
      ? Math.round(
          pages.reduce((s, p) => {
            if (p.pairs.length > 0) return s + p.healthScore;
            // Fallback: compute from violations/passes if pairs not populated
            const score = p.pairs.length > 0
              ? p.healthScore
              : p.violations.length === 0 ? 100 : Math.round((p.passes.length / (p.passes.length + p.violations.length)) * 100);
            return s + score;
          }, 0) / pages.length
        )
      : 0;

    const lines: string[] = [];

    if (thresholdViolations === 0) {
      lines.push(`✓ No contrast violations found (${totalChecked} elements checked)`);
      if (avgHealthScore > 0) {
        lines.push(`Health Score: ${avgHealthScore}/100`);
      }
      return { content: lines.join('\n'), exitCode: 0 };
    }

    lines.push(`${thresholdViolations} CONTRAST VIOLATION${thresholdViolations > 1 ? 'S' : ''} FOUND (${totalChecked} elements checked)`);
    if (avgHealthScore > 0) {
      lines.push(`Health Score: ${avgHealthScore}/100`);
    }
    if (totalVariableIssues > 0) {
      lines.push(`${totalVariableIssues} design system variable issue${totalVariableIssues > 1 ? 's' : ''} identified`);
    }
    lines.push('');
    lines.push('Tip: Even major brands trade strict contrast for visual identity. Aim for 100% AA compliance — that is the real-world standard.');
    lines.push('');

    pages.forEach((page) => {
      lines.push(renderPage(page));
    });

    return { content: lines.join('\n'), exitCode: 1 };
  },
};
