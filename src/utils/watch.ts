import { watch, FSWatcher } from 'fs';
import { resolve, dirname } from 'path';

export type WatchCallback = () => void;

interface WatchHandle {
  stop: () => void;
}

const DEBOUNCE_MS = 300;

/**
 * Watch a local file for changes and call the callback.
 */
export function watchFile(filePath: string, callback: WatchCallback): WatchHandle {
  const resolved = resolve(filePath);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(resolved, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        callback();
      }, DEBOUNCE_MS);
    }
  });

  return {
    stop: () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}

const WATCH_EXTENSIONS = new Set([
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte',
  '.md', '.mdx', '.json',
]);

/**
 * Watch the current working directory for frontend file changes.
 * Used when scanning a dev-server URL to auto-re-check on edits.
 */
export function watchProject(callback: WatchCallback): WatchHandle {
  const cwd = process.cwd();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const watcher = watch(cwd, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!WATCH_EXTENSIONS.has(ext)) return;
    if (filename.includes('node_modules')) return;
    if (filename.includes('.git')) return;

    if (eventType === 'change' || eventType === 'rename') {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        callback();
      }, DEBOUNCE_MS);
    }
  });

  return {
    stop: () => {
      if (timer) clearTimeout(timer);
      watcher.close();
    },
  };
}
