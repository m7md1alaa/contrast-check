import { BrowserManager } from './browser';

export interface ScreenshotTarget {
  selector: string;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export async function captureElementScreenshots(
  url: string,
  targets: ScreenshotTarget[],
  options: {
    headless?: boolean;
    viewport?: { width: number; height: number };
    darkMode?: boolean;
  }
): Promise<Map<number, string>> {
  const browser = new BrowserManager();
  await browser.launch(options.headless ?? true, options.viewport ?? { width: 1280, height: 720 });

  const results = new Map<number, string>();

  try {
    const page = await browser.newPage();

    if (options.darkMode) {
      await page.emulateMedia({ colorScheme: 'dark' });
    }

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      try {
        // Add padding around element for context
        const padding = 8;
        const clip = {
          x: Math.max(0, target.boundingRect.x - padding),
          y: Math.max(0, target.boundingRect.y - padding),
          width: target.boundingRect.width + padding * 2,
          height: target.boundingRect.height + padding * 2,
        };

        // Ensure clip stays within viewport
        const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
        clip.width = Math.min(clip.width, viewport.width - clip.x);
        clip.height = Math.min(clip.height, viewport.height - clip.y);

        const buffer = await page.screenshot({
          clip,
          type: 'png',
        });

        const base64 = buffer.toString('base64');
        results.set(i, `data:image/png;base64,${base64}`);
      } catch {
        // Silently skip elements that can't be screenshot
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}
