import { describe, test, expect } from 'vitest';
import { htmlFormatter } from '../../src/formatters/html';
import { jsonFormatter } from '../../src/formatters/json';
import { compactFormatter } from '../../src/formatters/compact';
import { AnalyzedPage } from '../../src/scanner/types';
import { generateReport } from '../../src/report/generator';

function makePage(overrides: Partial<AnalyzedPage> = {}): AnalyzedPage {
  return {
    url: 'https://example.com',
    title: 'Test Page',
    pairs: [],
    violations: [],
    passes: [],
    variableIssues: [],
    stats: { total: 0, passAA: 0, passAAA: 0, failAA: 0, failAAA: 0 },
    variableStats: { uniqueIssues: 0, affectedElements: 0, oneOffIssues: 0 },
    scannedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeViolation(text = 'bad text'): AnalyzedPage['violations'][number] {
  return {
    text,
    tag: 'div',
    color: '#888888',
    background: '#ffffff',
    selector: 'div.bad',
    xpath: '//div[1]',
    boundingRect: { x: 0, y: 0, width: 100, height: 20 },
    fontSize: '16px',
    fontWeight: '400',
    isVisible: true,
    fgParsed: { r: 136, g: 136, b: 136, a: 1 },
    bgParsed: { r: 255, g: 255, b: 255, a: 1 },
    contrastRatio: 3.54,
    aa: false,
    aaa: false,
    aaLarge: false,
    isLargeText: false,
    issueType: 'normal',
    suggestedFix: null,
  };
}

describe('htmlFormatter', () => {
  test('returns exit code 0 when no violations', () => {
    const result = htmlFormatter.format([makePage()]);
    expect(result.exitCode).toBe(0);
    expect(result.content).toContain('<!DOCTYPE html>');
  });

  test('returns exit code 1 when violations exist', () => {
    const page = makePage({
      violations: [makeViolation()],
      stats: { total: 1, passAA: 0, passAAA: 0, failAA: 1, failAAA: 1 },
    });
    const result = htmlFormatter.format([page]);
    expect(result.exitCode).toBe(1);
  });
});

describe('jsonFormatter', () => {
  test('returns valid JSON array', () => {
    const page = makePage({ url: 'https://example.com/page1' });
    const result = jsonFormatter.format([page]);

    const parsed = JSON.parse(result.content);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].url).toBe('https://example.com/page1');
  });

  test('returns exit code 0 when no violations', () => {
    const result = jsonFormatter.format([makePage()]);
    expect(result.exitCode).toBe(0);
  });

  test('returns exit code 1 when violations exist', () => {
    const page = makePage({
      violations: [makeViolation()],
      stats: { total: 1, passAA: 0, passAAA: 0, failAA: 1, failAAA: 1 },
    });
    const result = jsonFormatter.format([page]);
    expect(result.exitCode).toBe(1);
  });
});

describe('compactFormatter', () => {
  test('shows success message when no violations', () => {
    const result = compactFormatter.format([makePage({ stats: { total: 5, passAA: 5, passAAA: 3, failAA: 0, failAAA: 0 } })]);
    expect(result.content).toContain('No contrast violations found');
    expect(result.exitCode).toBe(0);
  });

  test('shows violation count in header', () => {
    const page = makePage({
      violations: [makeViolation(), makeViolation()],
      stats: { total: 2, passAA: 0, passAAA: 0, failAA: 2, failAAA: 2 },
    });
    const result = compactFormatter.format([page]);
    expect(result.content).toContain('2 CONTRAST VIOLATIONS FOUND');
    expect(result.exitCode).toBe(1);
  });

  test('shows variable issues when present', () => {
    const page = makePage({
      violations: [
        {
          ...makeViolation(),
          colorVar: '--text-muted',
        },
      ],
      variableIssues: [
        {
          variable: '--text-muted',
          property: 'color',
          currentValue: '#888888',
          currentHex: '#888888',
          againstVariable: null,
          againstValue: '#ffffff',
          againstHex: '#ffffff',
          contrastRatio: 3.54,
          aa: false,
          aaa: false,
          affectedCount: 1,
          suggestedFix: null,
          instances: [{ selector: 'div.bad', text: 'bad text', xpath: '//div[1]' }],
        },
      ],
      variableStats: { uniqueIssues: 1, affectedElements: 1, oneOffIssues: 0 },
      stats: { total: 1, passAA: 0, passAAA: 0, failAA: 1, failAAA: 1 },
    });
    const result = compactFormatter.format([page]);
    expect(result.content).toContain('Design System Issues');
    expect(result.content).toContain('--text-muted');
  });
});

describe('generateReport', () => {
  test('generates HTML with sidebar', () => {
    const html = generateReport([makePage({ title: 'Page 1' })]);
    expect(html).toContain('sidebar');
    expect(html).toContain('Page 1');
  });

  test('includes cross-page section when variable issues span pages', () => {
    const pages: AnalyzedPage[] = [
      makePage({
        url: 'https://example.com/a',
        title: 'Page A',
        variableIssues: [
          {
            variable: '--text-muted',
            property: 'color',
            currentValue: '#888888',
            currentHex: '#888888',
            againstVariable: null,
            againstValue: '#ffffff',
            againstHex: '#ffffff',
            contrastRatio: 3.54,
            aa: false,
            aaa: false,
            affectedCount: 1,
            suggestedFix: null,
            instances: [],
          },
        ],
        variableStats: { uniqueIssues: 1, affectedElements: 1, oneOffIssues: 0 },
      }),
      makePage({
        url: 'https://example.com/b',
        title: 'Page B',
        variableIssues: [
          {
            variable: '--text-muted',
            property: 'color',
            currentValue: '#888888',
            currentHex: '#888888',
            againstVariable: null,
            againstValue: '#ffffff',
            againstHex: '#ffffff',
            contrastRatio: 3.54,
            aa: false,
            aaa: false,
            affectedCount: 1,
            suggestedFix: null,
            instances: [],
          },
        ],
        variableStats: { uniqueIssues: 1, affectedElements: 1, oneOffIssues: 0 },
      }),
    ];

    const html = generateReport(pages);
    expect(html).toContain('Cross-Page Design System Issues');
    expect(html).toContain('--text-muted');
  });

  test('escapes </script> in embedded JSON', () => {
    const page = makePage({
      violations: [
        {
          ...makeViolation('This contains </script> tag'),
          text: 'This contains </script> tag',
        },
      ],
    });

    const html = generateReport([page]);
    // Extract the JSON data from the script tag
    const jsonMatch = html.match(/const pages = (\[[\s\S]*?\]);/);
    expect(jsonMatch).toBeTruthy();

    const jsonStr = jsonMatch![1];
    // The raw </script> tag should not appear inside the JSON data
    expect(jsonStr).not.toContain('</script>');
    // It should be escaped as unicode
    expect(jsonStr).toContain('\\u003c/script>');

    // Verify the JSON is still valid and parseable
    const parsed = JSON.parse(jsonStr);
    expect(parsed[0].violations[0].text).toBe('This contains </script> tag');
  });

  test('contains responsive CSS breakpoint', () => {
    const html = generateReport([makePage()]);
    expect(html).toContain('@media (max-width:768px)');
  });

  test('contains valid embedded JSON data', () => {
    const page = makePage({ url: 'https://example.com', title: 'Test' });
    const html = generateReport([page]);

    const match = html.match(/const pages = (\[.*?\]);/s);
    expect(match).toBeTruthy();

    // The match captures the JSON array - parse it
    const jsonStr = match![1];
    const parsed = JSON.parse(jsonStr);
    expect(parsed[0].url).toBe('https://example.com');
    expect(parsed[0].title).toBe('Test');
  });
});
