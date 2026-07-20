import { watch, type WatchEvent, type UnwatchFn } from '@tauri-apps/plugin-fs';

let unwatchFn: UnwatchFn | null = null;
let currentPath: string | null = null;
let onChangeCallback: ((event: WatchEvent) => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 120;

// GVFS / remote mounts (e.g. SFTP via Nautilus/Thunar) don't deliver reliable
// inotify events, so for those paths we let Tauri fall back to poll-based watching.
function isRemotePath(path: string): boolean {
  return path.startsWith('/run/user/') && path.includes('/gvfs/');
}

export async function startFileWatcher(path: string, onChange: (event: WatchEvent) => void): Promise<void> {
  if (unwatchFn !== null) {
    await stopFileWatcher();
  }

  currentPath = path;
  onChangeCallback = onChange;

  try {
    unwatchFn = await watch(
      path,
      (event) => {
        if (!onChangeCallback) return;
        if (currentPath && !event.paths.includes(currentPath)) return;

        // Debounce bursts of modify events into a single reload.
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          onChangeCallback?.(event);
        }, DEBOUNCE_MS);
      },
      { delayMs: 100, recursive: false }
    );
    console.log(`File watcher started for: ${path}`);
  } catch (err) {
    // Fall back to polling for paths that don't support inotify (GVFS/remote).
    if (isRemotePath(path)) {
      try {
        unwatchFn = await watch(
          path,
          (event) => {
            if (!onChangeCallback) return;
            if (currentPath && !event.paths.includes(currentPath)) return;
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => onChangeCallback?.(event), DEBOUNCE_MS);
          },
          { delayMs: 500, recursive: false }
        );
        console.log(`File watcher (poll fallback) started for: ${path}`);
        return;
      } catch (err2) {
        console.error('Failed to start poll file watcher:', err2);
        return;
      }
    }
    console.error('Failed to start file watcher:', err);
  }
}

export async function stopFileWatcher(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (unwatchFn !== null) {
    try {
      await unwatchFn();
      unwatchFn = null;
      currentPath = null;
      onChangeCallback = null;
      console.log('File watcher stopped');
    } catch (err) {
      console.error('Failed to stop file watcher:', err);
    }
  }
}

