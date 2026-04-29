import { BrowserManager } from './browser.js';
import { createExtractorScript } from './extractor.js';
import { PageResult } from './types.js';

export interface ScanOptions {
  url: string;
  headless?: boolean;
  viewport?: { width: number; height: number };
  darkMode?: boolean;
}

export async function scanPage(options: ScanOptions): Promise<PageResult> {
  const browser = new BrowserManager();
  await browser.launch(options.headless ?? true, options.viewport ?? { width: 1280, height: 720 });

  try {
    const page = await browser.newPage();

    if (options.darkMode) {
      await page.emulateMedia({ colorScheme: 'dark' });
    }

    await page.goto(options.url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait a bit for any runtime theme changes
    await page.waitForTimeout(1000);

    const title = await page.title();

    const extractor = createExtractorScript();
    const pairs = await page.evaluate(extractor as any) as import('./types.js').ElementColorPair[];

    return {
      url: options.url,
      title,
      pairs,
      scannedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
