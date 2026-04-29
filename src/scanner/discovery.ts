import { Page } from 'playwright';

export interface DiscoveryOptions {
  baseUrl: string;
  maxPages?: number;
  depth?: number;
  exclude?: string[];
  includeQueryParams?: boolean;
}

const DEFAULT_EXCLUDE_PATTERNS = [
  '/login',
  '/logout',
  '/auth',
  '/admin',
  '/api',
  '/cdn-cgi',
  '/wp-login',
  '/wp-admin',
];

const NON_PAGE_EXTENSIONS = [
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
  '.mp4', '.mp3', '.avi', '.mov', '.wmv',
  '.css', '.js', '.mjs', '.json', '.xml', '.rss', '.atom',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.md', '.csv',
];

function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const a = new URL(url1);
    const b = new URL(url2);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    // Remove fragment
    url.hash = '';
    // Remove trailing slash for deduplication
    let result = url.toString();
    if (result.endsWith('/') && result !== `${url.origin}/`) {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return null;
  }
}

function shouldIncludeUrl(
  url: string,
  baseUrl: string,
  excludePatterns: string[],
  includeQueryParams: boolean
): boolean {
  // Must be same origin
  if (!isSameOrigin(url, baseUrl)) return false;

  const parsed = new URL(url);
  const pathname = parsed.pathname.toLowerCase();

  // Skip non-page file extensions
  for (const ext of NON_PAGE_EXTENSIONS) {
    if (pathname.endsWith(ext)) return false;
  }

  // Skip URLs with query params unless explicitly allowed
  if (!includeQueryParams && parsed.search) return false;

  // Skip excluded patterns
  for (const pattern of excludePatterns) {
    const lowerPattern = pattern.toLowerCase();
    if (pathname.includes(lowerPattern)) return false;
  }

  return true;
}

export async function extractLinks(page: Page, baseUrl: string): Promise<string[]> {
  const links = await page.evaluate(() => {
    const results: string[] = [];
    const anchors = document.querySelectorAll('a[href]');
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        results.push(href);
      }
    }
    return results;
  });

  return links;
}

export async function discoverPages(
  page: Page,
  options: DiscoveryOptions
): Promise<string[]> {
  const { baseUrl, maxPages = 10, depth = 1, exclude = [], includeQueryParams = false } = options;

  const excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...exclude];
  const discovered = new Set<string>();
  const toVisit = new Set<string>();

  // Start with the base URL
  const normalizedBase = normalizeUrl(baseUrl, baseUrl);
  if (normalizedBase) {
    discovered.add(normalizedBase);
  }

  let currentDepth = 0;
  let currentFrontier: string[] = normalizedBase ? [normalizedBase] : [];

  while (currentDepth < depth && discovered.size < maxPages) {
    const nextFrontier: string[] = [];

    for (const url of currentFrontier) {
      if (discovered.size >= maxPages) break;

      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        await page.waitForTimeout(500);

        const rawLinks = await extractLinks(page, url);

        for (const href of rawLinks) {
          if (discovered.size >= maxPages) break;

          const normalized = normalizeUrl(href, url);
          if (!normalized) continue;
          if (discovered.has(normalized)) continue;

          if (shouldIncludeUrl(normalized, baseUrl, excludePatterns, includeQueryParams)) {
            discovered.add(normalized);
            if (currentDepth + 1 < depth) {
              nextFrontier.push(normalized);
            }
          }
        }
      } catch {
        // Skip pages that fail to load during discovery
      }
    }

    currentFrontier = nextFrontier;
    currentDepth++;
  }

  return Array.from(discovered);
}
