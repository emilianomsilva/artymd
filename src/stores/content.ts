import { writable, derived, get } from 'svelte/store';

export interface TabItem {
  id: string;
  name: string;
  path: string | null;
  text: string;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const initialTabId = generateId();
const defaultTab: TabItem = {
  id: initialTabId,
  name: 'Untitled.md',
  path: null,
  text: ''
};

export const tabsList = writable<TabItem[]>([defaultTab]);
export const activeTabId = writable<string>(initialTabId);

// Tab switch callbacks for cleanup (e.g., Mermaid)
const tabSwitchCallbacks: Array<() => void> = [];

export function onTabSwitch(callback: () => void) {
  tabSwitchCallbacks.push(callback);
  return () => {
    const idx = tabSwitchCallbacks.indexOf(callback);
    if (idx > -1) tabSwitchCallbacks.splice(idx, 1);
  };
}

function notifyTabSwitch() {
  tabSwitchCallbacks.forEach(cb => cb());
}

export const currentFileText = writable<string>('');
export const currentFilePath = writable<string | null>(null);
export const currentFileName = writable<string>('Untitled.md');

let isSyncingStore = false;

function updateActiveTabField<K extends keyof TabItem>(key: K, value: TabItem[K]) {
  if (isSyncingStore) return;
  const activeId = get(activeTabId);
  tabsList.update(list =>
    list.map(tab => tab.id === activeId ? { ...tab, [key]: value } : tab)
  );
}

currentFileText.subscribe(val => updateActiveTabField('text', val));
currentFilePath.subscribe(val => updateActiveTabField('path', val));
currentFileName.subscribe(val => updateActiveTabField('name', val));

export function switchTab(tabId: string) {
  const list = get(tabsList);
  const targetTab = list.find(t => t.id === tabId);
  if (targetTab) {
    isSyncingStore = true;
    activeTabId.set(tabId);
    currentFileText.set(targetTab.text);
    currentFilePath.set(targetTab.path);
    currentFileName.set(targetTab.name);
    isSyncingStore = false;
    notifyTabSwitch();
  }
}

export function createNewTab(initialText = '', initialPath: string | null = null, initialName = 'Untitled.md'): string {
  const newId = generateId();
  const newTab: TabItem = {
    id: newId,
    name: initialName,
    path: initialPath,
    text: initialText
  };
  tabsList.update(list => [...list, newTab]);
  switchTab(newId);
  return newId;
}

export function openFileInTab(contents: string, path: string, name: string) {
  const list = get(tabsList);
  const existingTab = list.find(t => t.path === path);
  if (existingTab) {
    switchTab(existingTab.id);
    return;
  }

  const textVal = get(currentFileText);
  const pathVal = get(currentFilePath);

  const shouldCreateNew = textVal !== '' || pathVal !== null;
  if (shouldCreateNew) {
    createNewTab(contents, path, name);
  } else {
    currentFilePath.set(path);
    currentFileName.set(name);
    currentFileText.set(contents);
  }
}

export async function closeTab(tabId: string): Promise<boolean> {
  const list = get(tabsList);
  const remaining = list.filter(t => t.id !== tabId);
  if (remaining.length === 0) {
    const newId = generateId();
    const newTab: TabItem = {
      id: newId,
      name: 'Untitled.md',
      path: null,
      text: ''
    };
    tabsList.set([newTab]);
    switchTab(newId);
  } else {
    tabsList.set(remaining);
    const activeId = get(activeTabId);
    if (activeId === tabId) {
      switchTab(remaining[0].id);
    }
  }
  return true;
}

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export const toc = derived(currentFileText, ($text) => {
  const items: TocItem[] = [];
  const lines = $text.split('\n');
  let codeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      codeBlock = !codeBlock;
      continue;
    }
    if (codeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      items.push({ id, text, level });
    }
  }
  return items;
});

// ==========================================================
// Session persistence (G8): remember open tabs across launches
// ==========================================================
const SESSION_KEY = 'artymd.session';

interface PersistedTab {
  id: string;
  name: string;
  path: string | null;
  text: string;
}

interface PersistedSession {
  tabs: PersistedTab[];
  activeTabId: string;
}

export function saveSession(): void {
  try {
    const session: PersistedSession = {
      tabs: get(tabsList).map(t => ({ id: t.id, name: t.name, path: t.path, text: t.text })),
      activeTabId: get(activeTabId)
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn('Failed to save session:', err);
  }
}

export function loadSession(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw) as PersistedSession;
    if (!session.tabs || session.tabs.length === 0) return false;

    tabsList.set(session.tabs.map(t => ({ ...t })));
    const active = session.tabs.find(t => t.id === session.activeTabId) ? session.activeTabId : session.tabs[0].id;
    switchTab(active);
    return true;
  } catch (err) {
    console.warn('Failed to load session:', err);
    return false;
  }
}

// Persist on tab/active changes (debounced to avoid thrashing localStorage).
let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSessionSave() {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(saveSession, 500);
}
tabsList.subscribe(() => scheduleSessionSave());
activeTabId.subscribe(() => scheduleSessionSave());
