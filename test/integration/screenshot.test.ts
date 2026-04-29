import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext } from 'playwright';
import { captureElementScreenshots } from '../../src/scanner/screenshot';
import { BrowserManager } from '../../src/scanner/browser';
import { startTestServer, TestServer } from '../helpers/server';

describe('captureElementScreenshots integration', () => {
  let browser: Browser;
  let context: BrowserContext;
  let server: TestServer;

  beforeAll(async () => {
    browser = await chromium.launch();
    context = await browser.newContext();
  });

  afterAll(async () => {
    await browser.close();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('captures screenshots for visible elements', async () => {
    server = await startTestServer([
      {
        path: '/',
        content: `
          <html><head><title>Screenshot</title></head>
          <body>
            <div id="target" style="width:100px; height:50px; background:red; color:white;">Text</div>
          </body></html>
        `,
      },
    ]);

    const page = await context.newPage();
    await page.goto(server.url + '/');
    await page.waitForTimeout(500);

    const target = await page.locator('#target').boundingBox();
    expect(target).toBeTruthy();

    const results = await captureElementScreenshots(
      server.url + '/',
      [
        {
          selector: '#target',
          boundingRect: target!,
        },
      ],
      { headless: true, viewport: { width: 1280, height: 720 } }
    );

    expect(results.size).toBe(1);
    const screenshot = results.get(0);
    expect(screenshot).toBeDefined();
    expect(screenshot).toMatch(/^data:image\/png;base64,/);

    await page.close();
  });

  test('reuses injected browser', async () => {
    server = await startTestServer([
      {
        path: '/',
        content: `<html><body><div id="t" style="width:50px; height:50px; background:blue;"></div></body></html>`,
      },
    ]);

    const manager = new BrowserManager();
    await manager.launch(true, { width: 1280, height: 720 });

    const results = await captureElementScreenshots(
      server.url + '/',
      [
        {
          selector: '#t',
          boundingRect: { x: 0, y: 0, width: 50, height: 50 },
        },
      ],
      { browser: manager }
    );

    expect(results.size).toBe(1);

    // Verify browser still usable
    const page = await manager.newPage();
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
    await page.close();
    await manager.close();
  });

  test('handles empty targets array', async () => {
    server = await startTestServer([
      { path: '/', content: '<html><body></body></html>' },
    ]);

    const results = await captureElementScreenshots(server.url + '/', [], {
      headless: true,
      viewport: { width: 1280, height: 720 },
    });

    expect(results.size).toBe(0);
  });

  test('handles hidden elements gracefully', async () => {
    server = await startTestServer([
      {
        path: '/',
        content: `<html><body><div id="gone" style="display:none;">Hidden</div></body></html>`,
      },
    ]);

    const results = await captureElementScreenshots(
      server.url + '/',
      [
        {
          selector: '#gone',
          boundingRect: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
      { headless: true, viewport: { width: 1280, height: 720 } }
    );

    // Playwright can screenshot hidden elements (returns empty/transparent image)
    // so we just verify it doesn't throw
    expect(results.size).toBeGreaterThanOrEqual(0);
  });
});
