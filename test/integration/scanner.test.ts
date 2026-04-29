import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext } from 'playwright';
import { scanPage } from '../../src/scanner/crawler';
import { BrowserManager } from '../../src/scanner/browser';
import { startTestServer, TestServer } from '../helpers/server';

describe('scanPage integration', () => {
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

  test('extracts color pairs from local HTML', async () => {
    server = await startTestServer([
      {
        path: '/',
        content: `
          <!DOCTYPE html>
          <html>
          <head><title>Test</title></head>
          <body>
            <div style="color:#000000; background:#ffffff;">Good contrast</div>
            <div style="color:#888888; background:#ffffff;">Bad contrast</div>
          </body>
          </html>
        `,
      },
    ]);

    const result = await scanPage({
      url: server.url + '/',
      headless: true,
      viewport: { width: 1280, height: 720 },
    });

    expect(result.url).toBe(server.url + '/');
    expect(result.title).toBe('Test');
    expect(result.pairs.length).toBeGreaterThanOrEqual(2);

    const texts = result.pairs.map((p) => p.text);
    expect(texts).toContain('Good contrast');
    expect(texts).toContain('Bad contrast');
  });

  test('reuses injected browser', async () => {
    server = await startTestServer([
      {
        path: '/',
        content: `<html><head><title>Reuse</title></head><body><div style="color:#000; background:#fff;">Text</div></body></html>`,
      },
    ]);

    const manager = new BrowserManager();
    await manager.launch(true, { width: 1280, height: 720 });

    const result = await scanPage({
      url: server.url + '/',
      browser: manager,
    });

    expect(result.title).toBe('Reuse');

    // Verify browser is still usable
    const page = await manager.newPage();
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
    await page.close();
    await manager.close();
  });

  test('closes page even on goto failure', async () => {
    const manager = new BrowserManager();
    await manager.launch(true, { width: 1280, height: 720 });

    await expect(
      scanPage({
        url: 'http://127.0.0.1:1/nonexistent',
        browser: manager,
      })
    ).rejects.toThrow();

    // Browser should still be usable
    const page = await manager.newPage();
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
    await page.close();
    await manager.close();
  });
});
