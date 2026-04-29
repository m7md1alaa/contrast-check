import { scanPage } from '../scanner/crawler.js';
import { captureElementScreenshots } from '../scanner/screenshot.js';
import { parseColor, rgbToHex } from '../analyzer/color.js';
import { calculateContrast } from '../analyzer/contrast.js';
import { suggestFix } from '../analyzer/suggest.js';
import { generateReport } from '../report/generator.js';
import { logger } from '../utils/logger.js';
import { resolveTarget } from '../utils/url.js';
import { AnalyzedPage } from '../scanner/types.js';
import { writeFileSync, existsSync } from 'fs';

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
  const target = resolveTarget(url);

  // Pre-flight validation for local files
  if (target.type === 'file' && target.absolutePath && !existsSync(target.absolutePath)) {
    logger.error(`File not found: ${target.original}`);
    logger.info(`Searched at: ${target.absolutePath}`);
    logger.info(`If this is a website, use: https://${target.original}`);
    process.exit(1);
  }

  const targetUrl = target.value;
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

    // Capture screenshots for violations
    if (!options.json && analyzed.violations.length > 0) {
      const screenshotSpinner = logger.startSpinner(`Capturing screenshots for ${analyzed.violations.length} violations...`);
      try {
        const screenshotTargets = analyzed.violations.map((v) => ({
          selector: v.selector,
          boundingRect: v.boundingRect,
        }));

        const screenshots = await captureElementScreenshots(targetUrl, screenshotTargets, {
          headless: options.headless,
          viewport: { width: width || 1280, height: height || 720 },
          darkMode: options.darkMode ?? false,
        });

        screenshots.forEach((base64, index) => {
          analyzed.violations[index].screenshot = base64;
        });

        logger.stopSpinner(`Captured ${screenshots.size} screenshots`);
      } catch {
        logger.stopSpinner('Screenshot capture skipped', false);
      }
    }

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

    // Provide helpful suggestions based on the error and target type
    const errMsg = err.message || '';
    if (target.type === 'url' && (errMsg.includes('ERR_NAME_NOT_RESOLVED') || errMsg.includes('net::ERR_CONNECTION_REFUSED'))) {
      logger.info(`Could not reach ${targetUrl}`);
      const isLocalhostLike = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])/.test(url);
      if (!url.startsWith('http://') && !url.startsWith('https://') && !isLocalhostLike) {
        logger.info(`If this is a local file, try: ./${url} or file:///absolute/path/to/${url}`);
      }
      if (isLocalhostLike && errMsg.includes('ERR_CONNECTION_REFUSED')) {
        logger.info(`Tip: Make sure your dev server is running on ${targetUrl}`);
      }
    }

    process.exit(1);
  }
}
