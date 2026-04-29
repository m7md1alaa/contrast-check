import { scanPage } from '../scanner/crawler';
import { captureElementScreenshots } from '../scanner/screenshot';
import { parseColor, rgbToHex } from '../analyzer/color';
import { calculateContrast } from '../analyzer/contrast';
import { suggestFix } from '../analyzer/suggest';
import { generateReport } from '../report/generator';
import { logger } from '../utils/logger';
import { resolveTarget } from '../utils/url';
import { AnalyzedPage } from '../scanner/types';
import { writeFileSync, existsSync } from 'fs';
import { getFormatter } from '../formatters';
import { watchFile, watchProject } from '../utils/watch';

function isLargeText(fontSize: string, fontWeight: string): boolean {
  const size = parseFloat(fontSize);
  const weight = parseInt(fontWeight) || 400;
  if (isNaN(size)) return false;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

export interface CheckOptions {
  output: string;
  headless: boolean;
  viewport: string;
  darkMode?: boolean;
  format?: string;
  json?: boolean;
  quiet?: boolean;
  watch?: boolean;
  all?: boolean;
}

async function analyze(
  targetUrl: string,
  options: CheckOptions
): Promise<AnalyzedPage> {
  const [width, height] = options.viewport.split('x').map(Number);

  const spinner = options.quiet
    ? null
    : logger.startSpinner('Loading page and extracting colors...');

  const result = await scanPage({
    url: targetUrl,
    headless: options.headless,
    viewport: { width: width || 1280, height: height || 720 },
    darkMode: options.darkMode ?? false,
  });

  if (spinner) logger.stopSpinner(`Found ${result.pairs.length} unique color pairs`);

  const analyzed: AnalyzedPage = {
    url: result.url,
    title: result.title,
    pairs: [],
    violations: [],
    passes: [],
    stats: { total: 0, passAA: 0, passAAA: 0, failAA: 0, failAAA: 0 },
    scannedAt: result.scannedAt,
  };

  const analyzeSpinner = options.quiet
    ? null
    : logger.startSpinner('Analyzing contrast ratios...');

  for (const pair of result.pairs) {
    const fgParsed = parseColor(pair.color);
    const bgParsed = parseColor(pair.background);

    if (!fgParsed || !bgParsed) continue;
    if (pair.background.startsWith('image:')) continue;

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

  if (analyzeSpinner)
    logger.stopSpinner(
      `Analysis complete: ${analyzed.stats.passAA} pass, ${analyzed.stats.failAA} fail`
    );

  // Capture screenshots for violations (only in HTML mode and not quiet)
  const isHtml = !options.format || options.format === 'html';
  if (isHtml && analyzed.violations.length > 0) {
    const screenshotSpinner = options.quiet
      ? null
      : logger.startSpinner(
          `Capturing screenshots for ${analyzed.violations.length} violations...`
        );
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

      if (screenshotSpinner)
        logger.stopSpinner(`Captured ${screenshots.size} screenshots`);
    } catch {
      if (screenshotSpinner) logger.stopSpinner('Screenshot capture skipped', false);
    }
  }

  return analyzed;
}

async function output(
  analyzed: AnalyzedPage,
  options: CheckOptions
): Promise<number> {
  const format = options.format || 'html';
  const formatter = getFormatter(format);

  // Default to failures-only unless --all is passed
  const page = options.all
    ? analyzed
    : {
        ...analyzed,
        pairs: analyzed.violations,
        passes: [],
      };

  const result = formatter.format([page], { outputPath: options.output, quiet: options.quiet });

  if (format === 'html') {
    const reportSpinner = options.quiet ? null : logger.startSpinner('Generating HTML report...');
    writeFileSync(options.output, result.content);
    if (!options.quiet) {
      if (reportSpinner) logger.stopSpinner(`Report saved to ${options.output}`);
      logger.box(
        'Summary',
        `
URL: ${analyzed.url}
Elements checked: ${analyzed.stats.total}
Pass AA: ${analyzed.stats.passAA} | Fail AA: ${analyzed.stats.failAA}
AAA: ${analyzed.stats.passAAA} | Fail: ${analyzed.stats.failAAA}
      `.trim()
      );

      if (analyzed.violations.length > 0) {
        logger.warning(
          `${analyzed.violations.length} contrast violations found. Open ${options.output} to review.`
        );
      } else {
        logger.success('No contrast violations found!');
      }
    }
  } else {
    console.log(result.content);
  }

  return result.exitCode;
}

export async function checkCommand(url: string, options: CheckOptions) {
  const target = resolveTarget(url);

  // Pre-flight validation for local files
  if (target.type === 'file' && target.absolutePath && !existsSync(target.absolutePath)) {
    logger.error(`File not found: ${target.original}`);
    logger.info(`Searched at: ${target.absolutePath}`);
    logger.info(`If this is a website, use: https://${target.original}`);
    process.exit(1);
  }

  const targetUrl = target.value;

  // Legacy --json flag maps to json format
  if (options.json && (!options.format || options.format === 'html')) {
    options.format = 'json';
  }

  const run = async () => {
    if (!options.quiet) {
      logger.info(`Scanning: ${targetUrl}`);
    }

    try {
      const analyzed = await analyze(targetUrl, options);
      const exitCode = await output(analyzed, options);

      if (!options.watch) {
        process.exit(exitCode);
      }

      if (!options.quiet) {
        logger.info('Waiting for changes... (Ctrl+C to stop)');
      }
    } catch (err: any) {
      if (!options.quiet) {
        logger.error(`Error: ${err.message}`);
        const errMsg = err.message || '';
        if (
          target.type === 'url' &&
          (errMsg.includes('ERR_NAME_NOT_RESOLVED') || errMsg.includes('net::ERR_CONNECTION_REFUSED'))
        ) {
          logger.info(`Could not reach ${targetUrl}`);
          const isLocalhostLike = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])/.test(url);
          if (!url.startsWith('http://') && !url.startsWith('https://') && !isLocalhostLike) {
            logger.info(`If this is a local file, try: ./${url} or file:///absolute/path/to/${url}`);
          }
          if (isLocalhostLike && errMsg.includes('ERR_CONNECTION_REFUSED')) {
            logger.info(`Tip: Make sure your dev server is running on ${targetUrl}`);
          }
        }
      } else {
        // In quiet mode, print minimal error to stderr so agent sees it
        console.error(`ERROR: ${err.message}`);
      }

      if (!options.watch) {
        process.exit(1);
      }
    }
  };

  await run();

  if (options.watch) {
    const watcher =
      target.type === 'file' && target.absolutePath
        ? watchFile(target.absolutePath, run)
        : watchProject(run);

    process.on('SIGINT', () => {
      watcher.stop();
      process.exit(0);
    });
  }
}
