import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  isSameOrigin,
  normalizeUrl,
  shouldIncludeUrl,
  extractLinks,
  discoverPages,
} from '../../src/scanner/discovery';
import { startTestServer, TestServer } from '../helpers/server';

describe('isSameOrigin', () => {
  test('returns true for same origin', () => {
    expect(isSameOrigin('https://example.com/a', 'https://example.com/b')).toBe(true);
  });

  test('returns false for different hosts', () => {
    expect(isSameOrigin('https://example.com', 'https://other.com')).toBe(false);
  });

  test('returns false for different protocols', () => {
    expect(isSameOrigin('https://example.com', 'http://example.com')).toBe(false);
  });

  test('returns false for different ports', () => {
    expect(isSameOrigin('https://example.com:3000', 'https://example.com:4000')).toBe(false);
  });

  test('returns false for invalid URLs', () => {
    expect(isSameOrigin('not-a-url', 'https://example.com')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  test('strips fragments', () => {
    expect(normalizeUrl('https://example.com/page#section', 'https://example.com')).toBe('https://example.com/page');
  });

  test('strips trailing slash', () => {
    expect(normalizeUrl('https://example.com/about/', 'https://example.com')).toBe('https://example.com/about');
  });

  test('keeps root trailing slash', () => {
    expect(normalizeUrl('https://example.com/', 'https://example.com')).toBe('https://example.com/');
  });

  test('resolves relative URLs', () => {
    expect(normalizeUrl('/about', 'https://example.com')).toBe('https://example.com/about');
  });

  test('returns null for invalid URLs', () => {
    // Invalid hostname with spaces should fail URL parsing
    expect(normalizeUrl('http://example .com', 'https://example.com')).toBeNull();
  });
});

describe('shouldIncludeUrl', () => {
  test('includes same-origin URL', () => {
    expect(shouldIncludeUrl('https://example.com/about', 'https://example.com', [], false)).toBe(true);
  });

  test('excludes different origin', () => {
    expect(shouldIncludeUrl('https://other.com', 'https://example.com', [], false)).toBe(false);
  });

  test('excludes non-page extensions', () => {
    expect(shouldIncludeUrl('https://example.com/file.pdf', 'https://example.com', [], false)).toBe(false);
    expect(shouldIncludeUrl('https://example.com/image.png', 'https://example.com', [], false)).toBe(false);
    expect(shouldIncludeUrl('https://example.com/style.css', 'https://example.com', [], false)).toBe(false);
  });

  test('excludes URLs with query params by default', () => {
    expect(shouldIncludeUrl('https://example.com/page?foo=bar', 'https://example.com', [], false)).toBe(false);
  });

  test('includes URLs with query params when allowed', () => {
    expect(shouldIncludeUrl('https://example.com/page?foo=bar', 'https://example.com', [], true)).toBe(true);
  });

  test('excludes default patterns', () => {
    const defaultExcludes = ['/login', '/logout', '/auth', '/admin', '/api'];
    expect(shouldIncludeUrl('https://example.com/login', 'https://example.com', defaultExcludes, false)).toBe(false);
    expect(shouldIncludeUrl('https://example.com/admin/dashboard', 'https://example.com', defaultExcludes, false)).toBe(false);
    expect(shouldIncludeUrl('https://example.com/api/users', 'https://example.com', defaultExcludes, false)).toBe(false);
  });

  test('includes non-excluded paths', () => {
    expect(shouldIncludeUrl('https://example.com/dashboard', 'https://example.com', [], false)).toBe(true);
    expect(shouldIncludeUrl('https://example.com/about', 'https://example.com', [], false)).toBe(true);
  });
});

describe('extractLinks', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    context = await browser.newContext();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('extracts hrefs from anchor tags', async () => {
    page = await context.newPage();
    await page.setContent(`
      <a href="/page1">Page 1</a>
      <a href="/page2">Page 2</a>
      <a href="/page3">Page 3</a>
    `);

    const links = await extractLinks(page, 'https://example.com');
    expect(links).toEqual(['/page1', '/page2', '/page3']);
    await page.close();
  });

  test('skips fragment, javascript, mailto, tel links', async () => {
    page = await context.newPage();
    await page.setContent(`
      <a href="#section">Fragment</a>
      <a href="javascript:void(0)">JS</a>
      <a href="mailto:test@example.com">Email</a>
      <a href="tel:+1234567890">Phone</a>
      <a href="/valid">Valid</a>
    `);

    const links = await extractLinks(page, 'https://example.com');
    expect(links).toEqual(['/valid']);
    await page.close();
  });

  test('includes absolute URLs', async () => {
    page = await context.newPage();
    await page.setContent(`
      <a href="https://example.com/about">About</a>
      <a href="https://other.com/external">External</a>
    `);

    const links = await extractLinks(page, 'https://example.com');
    expect(links).toEqual(['https://example.com/about', 'https://other.com/external']);
    await page.close();
  });
});

describe('discoverPages integration', () => {
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

  test('discovers same-origin linked pages', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/about">About</a><a href="/contact">Contact</a>' },
      { path: '/about', content: '<h1>About</h1>' },
      { path: '/contact', content: '<h1>Contact</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/about');
    expect(discovered).toContain(server.url + '/contact');
    expect(discovered.length).toBe(3);
    await page.close();
  });

  test('excludes cross-origin links', async () => {
    server = await startTestServer([
      { path: '/', content: `<a href="/local">Local</a><a href="https://other.com/external">External</a>` },
      { path: '/local', content: '<h1>Local</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/local');
    expect(discovered).not.toContain('https://other.com/external');
    await page.close();
  });

  test('respects maxPages limit', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/p1">1</a><a href="/p2">2</a><a href="/p3">3</a><a href="/p4">4</a>' },
      { path: '/p1', content: '<h1>P1</h1>' },
      { path: '/p2', content: '<h1>P2</h1>' },
      { path: '/p3', content: '<h1>P3</h1>' },
      { path: '/p4', content: '<h1>P4</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 2,
      depth: 1,
    });

    expect(discovered.length).toBeLessThanOrEqual(2);
    await page.close();
  });

  test('depth 1 discovers base + direct links', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/level1">Level 1</a>' },
      { path: '/level1', content: '<a href="/level2">Level 2</a>' },
      { path: '/level2', content: '<h1>Level 2</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/level1');
    await page.close();
  });

  test('depth 2 discovers base + direct + second-level links', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/level1">Level 1</a>' },
      { path: '/level1', content: '<a href="/level2">Level 2</a>' },
      { path: '/level2', content: '<h1>Level 2</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 2,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/level1');
    expect(discovered).toContain(server.url + '/level2');
    await page.close();
  });

  test('depth 3 reaches deepest level', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/level1">Level 1</a>' },
      { path: '/level1', content: '<a href="/level2">Level 2</a>' },
      { path: '/level2', content: '<h1>Level 2</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 3,
    });

    expect(discovered).toContain(server.url + '/level2');
    await page.close();
  });

  test('excludes default patterns like login and admin', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/login">Login</a><a href="/admin">Admin</a><a href="/dashboard">Dashboard</a>' },
      { path: '/dashboard', content: '<h1>Dashboard</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/dashboard');
    expect(discovered).not.toContain(server.url + '/login');
    expect(discovered).not.toContain(server.url + '/admin');
    await page.close();
  });

  test('skips non-page files', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/doc.pdf">PDF</a><a href="/photo.jpg">Image</a><a href="/page.html">Page</a>' },
      { path: '/page.html', content: '<h1>Page</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/page.html');
    expect(discovered).not.toContain(server.url + '/doc.pdf');
    expect(discovered).not.toContain(server.url + '/photo.jpg');
    await page.close();
  });

  test('skips URLs with query params by default', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/page?foo=bar">Query</a><a href="/clean">Clean</a>' },
      { path: '/clean', content: '<h1>Clean</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/clean');
    expect(discovered).not.toContain(server.url + '/page?foo=bar');
    await page.close();
  });

  test('deduplicates trailing slashes', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/about">About</a><a href="/about/">About trailing</a>' },
      { path: '/about', content: '<h1>About</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    const aboutUrls = discovered.filter((u) => u.includes('/about'));
    expect(aboutUrls.length).toBe(1);
    await page.close();
  });

  test('gracefully handles page load failure', async () => {
    server = await startTestServer([
      { path: '/', content: '<a href="/missing">Missing</a><a href="/exists">Exists</a>' },
      { path: '/exists', content: '<h1>Exists</h1>' },
    ]);

    const page = await context.newPage();
    const discovered = await discoverPages(page, {
      baseUrl: server.url,
      maxPages: 10,
      depth: 1,
    });

    expect(discovered).toContain(server.url + '/');
    expect(discovered).toContain(server.url + '/exists');
    // Note: /missing is currently discovered (found on root page) even though it 404s.
    // The scan phase handles 404s gracefully. This is acceptable behavior.
    expect(discovered).toContain(server.url + '/missing');
    await page.close();
  });
});
