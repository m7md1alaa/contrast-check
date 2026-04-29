import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { runCli } from '../helpers/cli';
import { startTestServer, TestServer } from '../helpers/server';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_PATH = join(process.cwd(), 'test-output-report.html');

describe('CLI E2E', () => {
  let server: TestServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = undefined;
    }
  });

  afterAll(async () => {
    if (existsSync(OUTPUT_PATH)) unlinkSync(OUTPUT_PATH);
  });

  describe('single-page scan', () => {
    test('scans local HTML file and writes HTML report', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '-o', OUTPUT_PATH, '--quiet']);

      expect(result.exitCode).toBe(1); // Has violations
      expect(existsSync(OUTPUT_PATH)).toBe(true);

      const report = readFileSync(OUTPUT_PATH, 'utf-8');
      expect(report).toContain('ContrastCheck Report');
      expect(report).toContain('Poor gray on white contrast');
    });

    test('clean page exits with 0', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'clean-page.html');
      const result = await runCli([fixturePath, '-o', OUTPUT_PATH, '--quiet']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('format options', () => {
    test('--format json outputs valid JSON', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--format', 'json', '--quiet']);

      expect(result.exitCode).toBe(1);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].url).toContain('single-page.html');
    });

    test('--format compact outputs text summary', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--format', 'compact', '--quiet']);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('CONTRAST VIOLATION');
    });

    test('--json flag is alias for json format', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--json', '--quiet']);

      expect(result.exitCode).toBe(1);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe('crawl options', () => {
    test('--crawl --yes scans linked pages', async () => {
      server = await startTestServer([
        {
          path: '/',
          content: '<a href="/page-b">Page B</a><a href="/page-c">Page C</a>',
        },
        { path: '/page-b', content: '<h1>Page B</h1>' },
        { path: '/page-c', content: '<h1>Page C</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBeGreaterThan(1);

      const urls = parsed.map((p: any) => p.url);
      expect(urls.some((u: string) => u.includes('/page-b'))).toBe(true);
      expect(urls.some((u: string) => u.includes('/page-c'))).toBe(true);

      await server.stop();
      server = undefined as any;
    });

    test('--max-pages limits scan count', async () => {
      server = await startTestServer([
        {
          path: '/',
          content: '<a href="/p1">1</a><a href="/p2">2</a><a href="/p3">3</a>',
        },
        { path: '/p1', content: '<h1>P1</h1>' },
        { path: '/p2', content: '<h1>P2</h1>' },
        { path: '/p3', content: '<h1>P3</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--max-pages',
        '2',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBeLessThanOrEqual(2);

      await server.stop();
      server = undefined as any;
    });

    test('--depth 1 discovers root + direct links', async () => {
      server = await startTestServer([
        { path: '/', content: '<a href="/level1">Level 1</a>' },
        { path: '/level1', content: '<a href="/level2">Level 2</a>' },
        { path: '/level2', content: '<h1>Level 2</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--depth',
        '1',
        '--format',
        'json',
        '--quiet',
      ]);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBe(2);
    });

    test('--depth 2 discovers root + direct + second-level links', async () => {
      server = await startTestServer([
        { path: '/', content: '<a href="/level1">Level 1</a>' },
        { path: '/level1', content: '<a href="/level2">Level 2</a>' },
        { path: '/level2', content: '<h1>Level 2</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--depth',
        '2',
        '--format',
        'json',
        '--quiet',
      ]);

      const parsed = JSON.parse(result.stdout);
      expect(parsed.length).toBe(3);
    });
  });

  describe('smart defaults', () => {
    test('excludes login, admin, api paths during crawl', async () => {
      server = await startTestServer([
        {
          path: '/',
          content: `
            <a href="/login">Login</a>
            <a href="/admin">Admin</a>
            <a href="/api/data">API</a>
            <a href="/dashboard">Dashboard</a>
          `,
        },
        { path: '/dashboard', content: '<h1>Dashboard</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const urls = parsed.map((p: any) => p.url);

      expect(urls).toContain(server.url + '/');
      expect(urls).toContain(server.url + '/dashboard');
      expect(urls).not.toContain(server.url + '/login');
      expect(urls).not.toContain(server.url + '/admin');
      expect(urls).not.toContain(server.url + '/api/data');
    });

    test('skips non-page files during crawl', async () => {
      server = await startTestServer([
        {
          path: '/',
          content: `
            <a href="/doc.pdf">PDF</a>
            <a href="/image.png">Image</a>
            <a href="/page.html">Page</a>
          `,
        },
        { path: '/page.html', content: '<h1>Page</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const urls = parsed.map((p: any) => p.url);

      expect(urls).toContain(server.url + '/');
      expect(urls).toContain(server.url + '/page.html');
      expect(urls).not.toContain(server.url + '/doc.pdf');
      expect(urls).not.toContain(server.url + '/image.png');
    });

    test('skips URLs with query params during crawl', async () => {
      server = await startTestServer([
        {
          path: '/',
          content: `
            <a href="/page?foo=bar">Query</a>
            <a href="/clean">Clean</a>
          `,
        },
        { path: '/clean', content: '<h1>Clean</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const urls = parsed.map((p: any) => p.url);

      expect(urls).toContain(server.url + '/');
      expect(urls).toContain(server.url + '/clean');
      expect(urls).not.toContain(server.url + '/page?foo=bar');
    });
  });

  describe('error handling', () => {
    test('exits 1 for unreachable URL', async () => {
      const result = await runCli(['http://127.0.0.1:1/nonexistent', '--quiet']);
      expect(result.exitCode).toBe(1);
    });

    test('continues if individual pages fail during crawl', async () => {
      server = await startTestServer([
        {
          path: '/',
          content: `
            <a href="/exists">Exists</a>
            <a href="/missing">Missing</a>
          `,
        },
        { path: '/exists', content: '<h1>Exists</h1>' },
      ]);

      const result = await runCli([
        server.url,
        '--crawl',
        '--yes',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      const urls = parsed.map((p: any) => p.url);
      expect(urls).toContain(server.url + '/');
      expect(urls).toContain(server.url + '/exists');
    });
  });

  describe('input validation', () => {
    test('--depth 0 exits with validation error', async () => {
      const fixturesDir = join(process.cwd(), 'test', 'fixtures');
      const result = await runCli([
        join(fixturesDir, 'linked-a.html'),
        '--crawl',
        '--yes',
        '--depth',
        '0',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Depth must be a positive integer');
    });

    test('--max-pages 0 exits with validation error', async () => {
      const fixturesDir = join(process.cwd(), 'test', 'fixtures');
      const result = await runCli([
        join(fixturesDir, 'linked-a.html'),
        '--crawl',
        '--yes',
        '--max-pages',
        '0',
        '--format',
        'json',
        '--quiet',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Max pages must be a positive integer');
    });

    test('--format xml exits with validation error', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--format', 'xml', '--quiet']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Format must be one of: html, json, compact');
    });

    test('--viewport bad exits with validation error', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--viewport', 'bad', '--quiet']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Viewport must be in WxH format');
    });

    test('--depth abc exits with validation error', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--depth', 'abc', '--quiet']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid input');
    });
  });

  describe('report features', () => {
    test('HTML report contains sidebar with pass/fail status', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '-o', OUTPUT_PATH, '--quiet']);

      expect(result.exitCode).toBe(1);
      const report = readFileSync(OUTPUT_PATH, 'utf-8');
      expect(report).toContain('sidebar');
      expect(report).toContain('nav-dot');
      expect(report).toContain('nav-item');
    });

    test('--all includes passing elements', async () => {
      const fixturePath = join(process.cwd(), 'test', 'fixtures', 'single-page.html');
      const result = await runCli([fixturePath, '--all', '--format', 'json', '--quiet']);

      expect(result.exitCode).toBe(1);
      const parsed = JSON.parse(result.stdout);
      const page = parsed[0];
      // With --all, pairs should include both passes and failures
      expect(page.pairs.length).toBeGreaterThan(page.violations.length);
    });
  });
});
