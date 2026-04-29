import { scanPage } from '../scanner/crawler.js';
import { parseColor, rgbToHex } from '../analyzer/color.js';
import { calculateContrast } from '../analyzer/contrast.js';
import { suggestFix } from '../analyzer/suggest.js';
import { generateReport } from '../report/generator.js';
import { logger } from '../utils/logger.js';
import { normalizeUrl } from '../utils/url.js';
import { AnalyzedPage } from '../scanner/types.js';
import { writeFileSync } from 'fs';

function isLargeText(fontSize: string, fontWeight: string): boolean {
  const size = parseFloat(fontSize);
  const weight = parseInt(fontWeight) || 400;
  // WCAG: 18pt (24px) normal or 14pt (18.66px) bold
  if (isNaN(size)) return false;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

export async function checkCommand(url: string, options: {
  output: string;
  headless: boolean;
  viewport: string;
  darkMode?: boolean;
  json?: boolean;
}) {
  const targetUrl = normalizeUrl(url);

  logger.info(`Scanning: ${targetUrl}`);

  const [width, height] = options.viewport.split('x').map(Number);

  const spinner = logger.startSpinner('Loading page and extracting colors...');

  try {
    const result = await scanPage({
      url: targetUrl,
      headless: options.headless,
      viewport: { width: width || 1280, height: height || 720 },
      darkMode: options.darkMode ?? false,
    });

    logger.stopSpinner(`Found ${result.pairs.length} unique color pairs`);

    const analyzed: AnalyzedPage = {
      url: result.url,
      title: result.title,
      pairs: [],
      violations: [],
      passes: [],
      stats: { total: 0, passAA: 0, passAAA: 0, failAA: 0, failAAA: 0 },
      scannedAt: result.scannedAt,
    };

    const analyzeSpinner = logger.startSpinner('Analyzing contrast ratios...');

    for (const pair of result.pairs) {
      const fgParsed = parseColor(pair.color);
      const bgParsed = parseColor(pair.background);

      if (!fgParsed || !bgParsed) continue;
      if (pair.background.startsWith('image:')) continue; // skip image backgrounds for now

      const contrast = calculateContrast(fgParsed, bgParsed);
      const isLarge = isLargeText(pair.fontSize, pair.fontWeight);
      const issueType = isLarge ? 'large' : 'normal';
      const threshold = isLarge ? 3 : 4.5;
      const suggestedFix = !contrast.aa ? suggestFix(fgParsed, bgParsed, threshold) : null;

      const analyzedPair = {
        ...pair,
        fgParsed,
        bgParsed,
        contrastRatio: contrast.ratio,
        aa: contrast.aa,
        aaa: contrast.aaa,
        aaLarge: contrast.aaLarge,
        isLargeText: isLarge,
        issueType: issueType as 'normal' | 'large',
        suggestedFix,
      };

      analyzed.pairs.push(analyzedPair);
      analyzed.stats.total++;

      if (contrast.aa) {
        analyzed.passes.push(analyzedPair);
        analyzed.stats.passAA++;
        if (contrast.aaa) analyzed.stats.passAAA++;
      } else {
        analyzed.violations.push(analyzedPair);
        analyzed.stats.failAA++;
        if (!contrast.aaLarge) analyzed.stats.failAAA++;
      }
    }

    logger.stopSpinner(`Analysis complete: ${analyzed.stats.passAA} pass, ${analyzed.stats.failAA} fail`);

    if (options.json) {
      console.log(JSON.stringify(analyzed, null, 2));
      process.exit(analyzed.violations.length > 0 ? 1 : 0);
    }

    const reportSpinner = logger.startSpinner('Generating HTML report...');
    const html = generateReport([analyzed]);
    writeFileSync(options.output, html);
    logger.stopSpinner(`Report saved to ${options.output}`);

    // Terminal summary
    logger.box('Summary', `
URL: ${analyzed.url}
Elements checked: ${analyzed.stats.total}
Pass AA: ${analyzed.stats.passAA} | Fail AA: ${analyzed.stats.failAA}
AAA: ${analyzed.stats.passAAA} | Fail: ${analyzed.stats.failAAA}
    `.trim());

    if (analyzed.violations.length > 0) {
      logger.warning(`${analyzed.violations.length} contrast violations found. Open ${options.output} to review.`);
    } else {
      logger.success('No contrast violations found!');
    }

    process.exit(analyzed.violations.length > 0 ? 1 : 0);
  } catch (err: any) {
    logger.stopSpinner(`Error: ${err.message}`, false);
    process.exit(1);
  }
}
