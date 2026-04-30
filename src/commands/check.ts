import { scanPage } from '../scanner/crawler';
import { captureElementScreenshots } from '../scanner/screenshot';
import { parseColor, rgbToHex } from '../analyzer/color';
import { calculateContrast } from '../analyzer/contrast';
import { suggestFix, suggestVariableFix } from '../analyzer/suggest';
import { getSeverity, calculateHealthScore } from '../analyzer/severity';
import { generateReport } from '../report/generator';
import { logger } from '../utils/logger';
import { resolveTarget } from '../utils/url';
import { AnalyzedPage, AnalyzedPair, VariableIssue } from '../scanner/types';
import { writeFileSync, existsSync } from 'fs';
import { getFormatter } from '../formatters';
import { watchFile, watchProject } from '../utils/watch';
import { BrowserManager } from '../scanner/browser';
import { discoverPages } from '../scanner/discovery';
import { ValidatedCheckOptions } from '../validation';
import inquirer from 'inquirer';

function isLargeText(fontSize: string, fontWeight: string): boolean {
  const size = parseFloat(fontSize);
  const weight = parseInt(fontWeight) || 400;
  if (isNaN(size)) return false;
  return size >= 24 || (size >= 18.66 && weight >= 700);
}

export type CheckOptions = ValidatedCheckOptions;

async function analyzePage(
  targetUrl: string,
  options: CheckOptions,
  browser: BrowserManager
): Promise<AnalyzedPage> {
  const [width, height] = options.viewport.split('x').map(Number);

  const result = await scanPage({
    url: targetUrl,
    headless: options.headless,
    viewport: { width: width || 1280, height: height || 720 },
    darkMode: options.darkMode ?? false,
    browser,
  });

  const analyzed: AnalyzedPage = {
    url: result.url,
    title: result.title,
    pairs: [],
    violations: [],
    passes: [],
    variableIssues: [],
    stats: { total: 0, passAA: 0, passAAA: 0, failAA: 0, failAAA: 0 },
    variableStats: { uniqueIssues: 0, affectedElements: 0, oneOffIssues: 0 },
    healthScore: 0,
    scannedAt: result.scannedAt,
  };

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
    const severity = getSeverity(contrast.ratio, isLarge);

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
      severity,
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

  // ── Group violations by CSS variable for design-system-aware reporting ──
  const varGroups = new Map<string, AnalyzedPair[]>();
  const oneOffViolations: AnalyzedPair[] = [];

  for (const v of analyzed.violations) {
    const hasVar = v.colorVar || v.bgVar;
    if (!hasVar) {
      oneOffViolations.push(v);
      continue;
    }
    const key = `${v.colorVar || 'raw'}|${v.bgVar || 'raw'}|${v.issueType}`;
    const group = varGroups.get(key);
    if (group) {
      group.push(v);
    } else {
      varGroups.set(key, [v]);
    }
  }

  const variableIssues: VariableIssue[] = [];
  for (const [, group] of varGroups) {
    const first = group[0];
    const variable = first.colorVar || first.bgVar!;
    const property: 'color' | 'background-color' = first.colorVar ? 'color' : 'background-color';
    const againstVariable = first.colorVar ? first.bgVar || null : first.colorVar || null;

    const currentValue = property === 'color' ? first.color : first.background;
    const againstValue = property === 'color' ? first.background : first.color;
    const threshold = first.isLargeText ? 3 : 4.5;
    const rawForSuggestion = currentValue;

    const variableSuggestion = suggestVariableFix(
      first.fgParsed!,
      first.bgParsed!,
      threshold,
      rawForSuggestion,
      variable,
      property
    );

    variableIssues.push({
      variable,
      property,
      currentValue,
      currentHex: rgbToHex(first.fgParsed!),
      againstVariable,
      againstValue,
      againstHex: rgbToHex(first.bgParsed!),
      contrastRatio: first.contrastRatio,
      aa: first.aa,
      aaa: first.aaa,
      severity: getSeverity(first.contrastRatio, first.isLargeText),
      affectedCount: group.length,
      suggestedFix: variableSuggestion
        ? {
            variable: variableSuggestion.variable,
            newValue: variableSuggestion.newValue,
            newHex: variableSuggestion.newHex,
            contrastRatio: variableSuggestion.contrastRatio,
            property: variableSuggestion.property,
          }
        : null,
      instances: group.map((g) => ({
        selector: g.selector,
        text: g.text,
        xpath: g.xpath,
      })),
    });
  }

  analyzed.variableIssues = variableIssues;
  analyzed.variableStats = {
    uniqueIssues: variableIssues.length,
    affectedElements: variableIssues.reduce((s, v) => s + v.affectedCount, 0),
    oneOffIssues: oneOffViolations.length,
  };
  analyzed.healthScore = calculateHealthScore(analyzed.pairs);

  return analyzed;
}

async function captureScreenshotsForPage(
  page: AnalyzedPage,
  options: CheckOptions,
  browser: BrowserManager
): Promise<void> {
  if (page.violations.length === 0) return;

  const [width, height] = options.viewport.split('x').map(Number);

  try {
    const screenshotTargets = page.violations.map((v) => ({
      selector: v.selector,
      boundingRect: v.boundingRect,
    }));

    const screenshots = await captureElementScreenshots(page.url, screenshotTargets, {
      headless: options.headless,
      viewport: { width: width || 1280, height: height || 720 },
      darkMode: options.darkMode ?? false,
      browser,
    });

    screenshots.forEach((base64, index) => {
      page.violations[index].screenshot = base64;
    });
  } catch {
    // Silently skip screenshot failures
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      await fn(items[currentIndex], currentIndex);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}

async function scanMultiplePages(
  urls: string[],
  options: CheckOptions,
  browser: BrowserManager
): Promise<AnalyzedPage[]> {
  const results: AnalyzedPage[] = [];
  const errors: { url: string; error: string }[] = [];
  const total = urls.length;

  await runWithConcurrency(urls, 3, async (url, index) => {
    if (!options.quiet) {
      logger.info(`Scanning page ${index + 1}/${total}: ${url}`);
    }

    try {
      const analyzed = await analyzePage(url, options, browser);
      results.push(analyzed);
    } catch (err: any) {
      errors.push({ url, error: err.message });
      if (!options.quiet) {
        logger.warning(`Failed to scan ${url}: ${err.message}`);
      }
    }
  });

  // Sort results by original URL order
  const urlOrder = new Map(urls.map((u, i) => [u, i]));
  results.sort((a, b) => (urlOrder.get(a.url) ?? 0) - (urlOrder.get(b.url) ?? 0));

  if (errors.length > 0 && !options.quiet) {
    logger.warning(`${errors.length} page(s) failed to scan`);
  }

  return results;
}

async function promptCrawl(urlCount: number): Promise<boolean> {
  if (!process.stdin.isTTY) return false;

  try {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Found ${urlCount} linked pages. Scan all?`,
        default: true,
      },
    ]);
    return confirm;
  } catch {
    return false;
  }
}

async function output(
  pages: AnalyzedPage[],
  options: CheckOptions
): Promise<number> {
  const format = options.format || 'html';
  const formatter = getFormatter(format);

  const totalViolations = pages.reduce((sum, p) => sum + p.violations.length, 0);
  const totalChecked = pages.reduce((sum, p) => sum + p.stats.total, 0);

  // Default to failures-only unless --all is passed
  const displayPages = options.all
    ? pages
    : pages.map((p) => ({
        ...p,
        pairs: p.violations,
        passes: [],
      }));

  const result = formatter.format(displayPages, { outputPath: options.output, quiet: options.quiet, threshold: options.threshold });

  if (format === 'html') {
    const reportSpinner = options.quiet ? null : logger.startSpinner('Generating HTML report...');
    writeFileSync(options.output, result.content);
    if (!options.quiet) {
      if (reportSpinner) logger.stopSpinner(`Report saved to ${options.output}`);

      const avgHealthScore = pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.healthScore, 0) / pages.length)
        : 0;

      logger.box(
        'Summary',
        `
Pages scanned: ${pages.length}
Elements checked: ${totalChecked}
Health Score: ${avgHealthScore}/100
Pass AA: ${pages.reduce((s, p) => s + p.stats.passAA, 0)} | Fail AA: ${pages.reduce((s, p) => s + p.stats.failAA, 0)}
AAA: ${pages.reduce((s, p) => s + p.stats.passAAA, 0)} | Fail: ${pages.reduce((s, p) => s + p.stats.failAAA, 0)}
      `.trim()
      );

      if (totalViolations > 0) {
        logger.warning(
          `${totalViolations} contrast issue${totalViolations > 1 ? 's' : ''} found. Open ${options.output} to review.`
        );
        logger.info('Tip: Even major brands trade strict contrast for visual identity. Aim for 100% AA compliance.');
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
  if (options.json && options.format === 'html') {
    options.format = 'json';
  }

  // Disable crawl when watching
  const enableCrawl = !options.watch && target.type === 'url';

  const run = async () => {
    if (!options.quiet) {
      logger.info(`Scanning: ${targetUrl}`);
    }

    try {
      const [width, height] = options.viewport.split('x').map(Number);
      const browser = new BrowserManager();
      await browser.launch(
        options.headless ?? true,
        { width: width || 1280, height: height || 720 }
      );

      let pagesToScan: string[] = [targetUrl];

      try {
        // ── Discover linked pages ──
        if (enableCrawl) {
          const discoverySpinner = options.quiet
            ? null
            : logger.startSpinner('Discovering linked pages...');

          let discoverPage;
          try {
            discoverPage = await browser.newPage();
            const discovered = await discoverPages(discoverPage, {
              baseUrl: targetUrl,
              maxPages: options.maxPages ?? 10,
              depth: options.depth ?? 1,
            });

            if (discoverySpinner) logger.stopSpinner(`Found ${discovered.length} page(s)`);

            if (discovered.length > 1) {
              const extraPages = discovered.filter((u) => u !== targetUrl);

              if (extraPages.length > 0) {
                let shouldCrawl = options.crawl || options.yes;

                if (!shouldCrawl && !options.quiet && process.stdin.isTTY) {
                  shouldCrawl = await promptCrawl(discovered.length);
                }

                if (shouldCrawl) {
                  pagesToScan = discovered;
                  if (!options.quiet) {
                    logger.info(`Scanning ${pagesToScan.length} pages`);
                  }
                } else {
                  if (!options.quiet) {
                    logger.info('Scanning single page only');
                  }
                }
              }
            }
          } catch (err: any) {
            if (discoverySpinner) logger.stopSpinner('Discovery failed, scanning single page', false);
            if (!options.quiet) {
              logger.warning(`Could not discover links: ${err.message}`);
            }
          } finally {
            if (discoverPage) {
              await discoverPage.close().catch(() => {});
            }
          }
        }

        // ── Scan all pages ──
        const pages = await scanMultiplePages(pagesToScan, options, browser);

        if (pages.length === 0 && pagesToScan.length > 0) {
          if (!options.quiet) {
            logger.error('All pages failed to scan');
          }
          await browser.close();
          process.exit(1);
        }

        // ── Capture screenshots ──
        const pagesWithViolations = pages.filter((p) => p.violations.length > 0);
        if (pagesWithViolations.length > 0) {
          const screenshotSpinner = options.quiet
            ? null
            : logger.startSpinner(
                `Capturing screenshots for violations across ${pagesWithViolations.length} page(s)...`
              );

          for (const page of pagesWithViolations) {
            await captureScreenshotsForPage(page, options, browser);
          }

          if (screenshotSpinner) {
            const totalViolations = pagesWithViolations.reduce((s, p) => s + p.violations.length, 0);
            logger.stopSpinner(`Captured screenshots for ${totalViolations} violation(s)`);
          }
        }

        // ── Output ──
        const exitCode = await output(pages, options);

        if (!options.watch) {
          await browser.close();
          process.exit(exitCode);
        }

        await browser.close();

        if (!options.quiet) {
          logger.info('Waiting for changes... (Ctrl+C to stop)');
        }
      } catch (err: any) {
        await browser.close();
        throw err;
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
