import { existsSync } from 'fs';
import { resolve } from 'path';

export interface ResolvedTarget {
  type: 'url' | 'file';
  value: string;
  original: string;
  absolutePath?: string;
}

function looksLikeFilePath(input: string): boolean {
  // Starts with relative or absolute path markers
  if (input.startsWith('./') || input.startsWith('../') || input.startsWith('/')) {
    return true;
  }
  // Has a common web file extension
  if (/\.(html?|php|asp|aspx|jsp|vue|jsx|tsx|svelte)$/i.test(input)) {
    return true;
  }
  // Exists on disk (could be a file without obvious extension)
  if (existsSync(input)) {
    return true;
  }
  return false;
}

function isLocalhost(input: string): boolean {
  return input.startsWith('localhost') || input.startsWith('127.0.0.1');
}

export function resolveTarget(input: string): ResolvedTarget {
  const original = input.trim();

  // Already has a protocol
  if (original.startsWith('file://')) {
    return { type: 'file', value: original, original };
  }
  if (original.startsWith('http://') || original.startsWith('https://')) {
    return { type: 'url', value: original, original };
  }

  // Looks like a file path
  if (looksLikeFilePath(original)) {
    const absolutePath = resolve(original);
    return {
      type: 'file',
      value: `file://${absolutePath}`,
      original,
      absolutePath,
    };
  }

  // Looks like localhost / IP address → use http
  if (isLocalhost(original)) {
    return { type: 'url', value: `http://${original}`, original };
  }

  // Default: treat as a web URL
  return { type: 'url', value: `https://${original}`, original };
}

export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const a = new URL(url1);
    const b = new URL(url2);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}
