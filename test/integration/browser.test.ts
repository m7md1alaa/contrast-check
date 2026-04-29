import { describe, test, expect } from 'vitest';
import { chromium } from 'playwright';
import { BrowserManager } from '../../src/scanner/browser';

describe('BrowserManager', () => {
  test('launch creates reusable context', async () => {
    const manager = new BrowserManager();
    await manager.launch(true, { width: 1280, height: 720 });

    const page1 = await manager.newPage();
    const page2 = await manager.newPage();
    const page3 = await manager.newPage();

    expect(page1).toBeDefined();
    expect(page2).toBeDefined();
    expect(page3).toBeDefined();

    await page1.close();
    await page2.close();
    await page3.close();
    await manager.close();
  });

  test('newPage throws if not launched', async () => {
    const manager = new BrowserManager();
    await expect(manager.newPage()).rejects.toThrow('Browser not launched');
  });

  test('close is idempotent', async () => {
    const manager = new BrowserManager();
    await manager.launch(true, { width: 1280, height: 720 });
    await manager.close();
    await expect(manager.close()).resolves.toBeUndefined();
  });

  test('pages can navigate after launch', async () => {
    const manager = new BrowserManager();
    await manager.launch(true, { width: 1280, height: 720 });

    const page = await manager.newPage();
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');

    await page.close();
    await manager.close();
  });

  test('launches headless browser by default', async () => {
    const manager = new BrowserManager();
    await manager.launch(true);
    const page = await manager.newPage();
    expect(page).toBeDefined();
    await page.close();
    await manager.close();
  });
});
