import { describe, test, expect } from 'vitest';
import { resolveTarget, isSameOrigin } from './url';

describe('resolveTarget', () => {
  test('resolves https:// URL as-is', () => {
    const result = resolveTarget('https://example.com');
    expect(result.type).toBe('url');
    expect(result.value).toBe('https://example.com');
    expect(result.original).toBe('https://example.com');
  });

  test('resolves http:// URL as-is', () => {
    const result = resolveTarget('http://example.com');
    expect(result.type).toBe('url');
    expect(result.value).toBe('http://example.com');
  });

  test('resolves file:// path as file', () => {
    const result = resolveTarget('file:///Users/test/page.html');
    expect(result.type).toBe('file');
    expect(result.value).toBe('file:///Users/test/page.html');
  });

  test('prepends https:// to bare domain', () => {
    const result = resolveTarget('example.com');
    expect(result.type).toBe('url');
    expect(result.value).toBe('https://example.com');
  });

  test('prepends http:// to localhost', () => {
    const result = resolveTarget('localhost:3000');
    expect(result.type).toBe('url');
    expect(result.value).toBe('http://localhost:3000');
  });

  test('prepends http:// to 127.0.0.1', () => {
    const result = resolveTarget('127.0.0.1:8080');
    expect(result.type).toBe('url');
    expect(result.value).toBe('http://127.0.0.1:8080');
  });

  test('resolves ./ relative path as file', () => {
    const result = resolveTarget('./index.html');
    expect(result.type).toBe('file');
    expect(result.value.startsWith('file://')).toBe(true);
    expect(result.absolutePath).toBeDefined();
  });

  test('resolves ../ relative path as file', () => {
    const result = resolveTarget('../page.html');
    expect(result.type).toBe('file');
    expect(result.value.startsWith('file://')).toBe(true);
  });

  test('resolves / absolute path as file', () => {
    const result = resolveTarget('/tmp/test.html');
    expect(result.type).toBe('file');
    expect(result.value).toBe('file:///tmp/test.html');
    expect(result.absolutePath).toBe('/tmp/test.html');
  });

  test('detects .html file without path prefix as file', () => {
    const result = resolveTarget('index.html');
    expect(result.type).toBe('file');
  });

  test('detects .vue file as file', () => {
    const result = resolveTarget('App.vue');
    expect(result.type).toBe('file');
  });

  test('trims whitespace from input', () => {
    const result = resolveTarget('  https://example.com  ');
    expect(result.value).toBe('https://example.com');
  });

  test('resolves URL with path and query string', () => {
    const result = resolveTarget('https://example.com/path?foo=bar');
    expect(result.type).toBe('url');
    expect(result.value).toBe('https://example.com/path?foo=bar');
  });

  test('resolves URL with custom protocol', () => {
    const result = resolveTarget('ftp://example.com');
    expect(result.type).toBe('url');
    expect(result.value).toBe('ftp://example.com');
  });
});

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
