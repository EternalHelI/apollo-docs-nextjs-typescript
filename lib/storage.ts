import type { ChangelogViewMode, DocMeta, DocsViewMode, ThemeMode, TrashItem } from '@/lib/types';

export const storageKeys = Object.freeze({
  index: 'apollo_docs_index_v1',
  trash: 'apollo_docs_trash_v1',
  theme: 'apollo_docs_theme_v1',
  view: 'apollo_docs_view_v1', // 'grid' | 'list'
  changelogView: 'apollo_docs_changelog_view_v1', // 'list' | 'grid'
  wordcount: 'apollo_docs_wordcount_v1',
  privateWarnDismiss: 'apollo_docs_private_warn_dismissed_v1'
});

export function getContentKey(id: string): string {
  return `apollo_docs_doc_${id}_delta`;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function canUseStorage(): boolean {
  if (!isBrowser()) return false;
  try {
    const k = '__apollo_ls_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return (parsed ?? fallback);
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadIndex(): DocMeta[] {
  const arr = loadJson<unknown>(storageKeys.index, []);
  return Array.isArray(arr) ? (arr as DocMeta[]) : [];
}

export function saveIndex(next: DocMeta[]): void {
  saveJson(storageKeys.index, Array.isArray(next) ? next : []);
}

export function loadTrash(): TrashItem[] {
  const arr = loadJson<unknown>(storageKeys.trash, []);
  return Array.isArray(arr) ? (arr as TrashItem[]) : [];
}

export function saveTrash(next: TrashItem[]): void {
  saveJson(storageKeys.trash, Array.isArray(next) ? next : []);
}

export function loadTheme(prefersLight: boolean): ThemeMode {
  if (!isBrowser()) return prefersLight ? 'light' : 'dark';
  try {
    const t = window.localStorage.getItem(storageKeys.theme);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    // ignore
  }
  return prefersLight ? 'light' : 'dark';
}

export function storeTheme(t: ThemeMode): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(storageKeys.theme, t); } catch {}
}

export function loadDocsView(): DocsViewMode {
  if (!isBrowser()) return 'grid';
  try {
    const v = window.localStorage.getItem(storageKeys.view);
    return (v === 'list' || v === 'grid') ? v : 'grid';
  } catch {
    return 'grid';
  }
}

export function storeDocsView(v: DocsViewMode): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(storageKeys.view, v); } catch {}
}

export function loadChangelogView(): ChangelogViewMode {
  if (!isBrowser()) return 'list';
  try {
    const v = window.localStorage.getItem(storageKeys.changelogView);
    return (v === 'list' || v === 'grid') ? v : 'list';
  } catch {
    return 'list';
  }
}

export function storeChangelogView(v: ChangelogViewMode): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(storageKeys.changelogView, v); } catch {}
}

export function loadWordCountPref(): boolean {
  if (!isBrowser()) return false;
  try { return window.localStorage.getItem(storageKeys.wordcount) === '1'; } catch { return false; }
}

export function storeWordCountPref(on: boolean): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(storageKeys.wordcount, on ? '1' : '0'); } catch {}
}

// Backward-compat aliases (older pages/imports)
export function loadWordCountEnabled(): boolean {
  return loadWordCountPref();
}

export function storeWordCountEnabled(on: boolean): void {
  storeWordCountPref(on);
}

export function loadDeltaRaw(docId: string): string | null {
  if (!isBrowser()) return null;
  try { return window.localStorage.getItem(getContentKey(docId)); } catch { return null; }
}

export function saveDeltaRaw(docId: string, raw: string): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(getContentKey(docId), raw); } catch {}
}

export function removeDelta(docId: string): void {
  if (!isBrowser()) return;
  try { window.localStorage.removeItem(getContentKey(docId)); } catch {}
}

export function privateWarnDismissed(): boolean {
  if (!isBrowser()) return false;
  try { return window.localStorage.getItem(storageKeys.privateWarnDismiss) === '1'; } catch { return false; }
}

export function dismissPrivateWarn(): void {
  if (!isBrowser()) return;
  try { window.localStorage.setItem(storageKeys.privateWarnDismiss, '1'); } catch {}
}
