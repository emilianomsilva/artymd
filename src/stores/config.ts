import { writable } from 'svelte/store';

// Load initial values from localStorage if available (offline-first persistence)
const getSystemTheme = () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const initialTheme = (localStorage.getItem('theme') as 'light' | 'dark') || getSystemTheme();
const initialZoom = parseFloat(localStorage.getItem('zoom') || '1.0');
const initialSidebarOpen = localStorage.getItem('sidebarOpen') !== 'false';
const initialRtl = localStorage.getItem('rtl') === 'true';
const VALID_PREVIEW_THEMES = ['default', 'github', 'academic', 'minimal', 'neutral', 'arty'] as const;
const storedPreviewTheme = localStorage.getItem('previewTheme');
const initialPreviewTheme = (VALID_PREVIEW_THEMES as readonly string[]).includes(storedPreviewTheme || '')
  ? (storedPreviewTheme as typeof VALID_PREVIEW_THEMES[number])
  : 'default';
const initialSidebarWidth = parseInt(localStorage.getItem('sidebarWidth') || '280');
const initialSidebarSide = (localStorage.getItem('sidebarSide') as 'left' | 'right') || 'left';

export const theme = writable<'light' | 'dark'>(initialTheme);
export const zoom = writable<number>(initialZoom);
export const sidebarOpen = writable<boolean>(initialSidebarOpen);
export const sidebarWidth = writable<number>(initialSidebarWidth);
export const sidebarSide = writable<'left' | 'right'>(initialSidebarSide);
export const rtl = writable<boolean>(initialRtl);
export const showHelp = writable<boolean>(false);
export const previewTheme = writable<'default' | 'github' | 'academic' | 'minimal' | 'neutral' | 'arty'>(initialPreviewTheme);

// Subscribe to store changes to persist in localStorage
theme.subscribe((val) => {
  localStorage.setItem('theme', val);
  if (typeof document !== 'undefined') {
    if (val === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});

zoom.subscribe((val) => {
  localStorage.setItem('zoom', val.toString());
});

sidebarOpen.subscribe((val) => {
  localStorage.setItem('sidebarOpen', val ? 'true' : 'false');
});

rtl.subscribe((val) => {
  localStorage.setItem('rtl', val ? 'true' : 'false');
});

previewTheme.subscribe((val) => {
  localStorage.setItem('previewTheme', val);
});

sidebarWidth.subscribe((val) => {
  localStorage.setItem('sidebarWidth', val.toString());
});

sidebarSide.subscribe((val) => {
  localStorage.setItem('sidebarSide', val);
});
