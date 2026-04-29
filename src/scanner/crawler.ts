import { BrowserManager } from './browser';
import { createExtractorScript } from './extractor';
import { PageResult } from './types';

export interface ScanOptions {
  url: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  darkMode?: boolean;
  browser?: BrowserManager;
}

export async function scanPage(options: ScanOptions): Promise<PageResult> {
  const ownBrowser = !options.browser;
  const browser = options.browser || new BrowserManager();

  if (ownBrowser) {
    await browser.launch(options.headless ?? true, options.viewport ?? { width: 1280, height: 720 });
  }

  let page;
  try {
    page = await browser.newPage();

    if (options.darkMode) {
      await page.emulateMedia({ colorScheme: 'dark' });
    }

    await page.goto(options.url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for any runtime theme changes
    await page.waitForTimeout(1000);

    const title = await page.title();

    const extractor = createExtractorScript();
    const pairs = await page.evaluate(extractor as any) as import('./types').ElementColorPair[];

    return {
      url: options.url,
      title,
      pairs,
      scannedAt: new Date().toISOString(),
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (ownBrowser) {
      await browser.close();
    }
  }
}
