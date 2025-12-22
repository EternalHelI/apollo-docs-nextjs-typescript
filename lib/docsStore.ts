import type { DocMeta, TrashItem } from '@/lib/types';
import { getContentKey, loadDeltaRaw, loadIndex, loadTrash, removeDelta, saveIndex, saveTrash } from '@/lib/storage';
import { generateId } from '@/lib/utils';

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function ensureDocMeta(docId: string, fallbackTitle = 'Apollo Document'): DocMeta {
  const idx = loadIndex();
  let doc = idx.find(d => d.id === docId);
  if (!doc) {
    doc = { id: docId, title: fallbackTitle, createdAt: Date.now(), updatedAt: Date.now() };
    idx.push(doc);
    saveIndex(idx);
  }
  return doc;
}

export function createDoc(title = 'Apollo Document'): DocMeta {
  const idx = loadIndex();
  // Preserve the historical ID shape used by v1 builds to minimize surprises.
  const id = "d_" + Date.now() + "_" + generateId();
  const doc: DocMeta = { id, title, createdAt: Date.now(), updatedAt: Date.now() };
  idx.push(doc);
  saveIndex(idx);
  return doc;
}

export function updateDocMeta(docId: string, patch: Partial<Omit<DocMeta, 'id' | 'createdAt'>> & { title?: string }): void {
  const idx = loadIndex();
  let doc = idx.find(d => d.id === docId);
  if (!doc) {
    doc = { id: docId, title: patch.title ?? 'Apollo Document', createdAt: Date.now(), updatedAt: Date.now() };
    idx.push(doc);
  }
  Object.assign(doc, patch);
  doc.updatedAt = Date.now();
  saveIndex(idx);
}

export function touchDoc(docId: string): void {
  const idx = loadIndex();
  const doc = idx.find(d => d.id === docId);
  if (doc) {
    doc.updatedAt = Date.now();
    saveIndex(idx);
    return;
  }

  // If the document does not exist yet, create minimal metadata so future saves are consistent.
  ensureDocMeta(docId, 'Apollo Document');
}

export function setDocTitle(docId: string, title: string): boolean {
  const next = (title || '').trim();
  if (!next) return false;
  updateDocMeta(docId, { title: next });
  return true;
}

export function openDocUrl(docId: string): string {
  return `/editor?id=${encodeURIComponent(docId)}`;
}

export function moveToArchive(docId: string): boolean {
  const idx = loadIndex();
  const i = idx.findIndex(d => d.id === docId);
  if (i < 0) return false;

  const doc = idx[i];
  idx.splice(i, 1);
  saveIndex(idx);

  const trash = loadTrash();
  const delta = loadDeltaRaw(docId);
  const item: TrashItem = {
    id: doc.id,
    title: doc.title || 'Untitled',
    createdAt: doc.createdAt || Date.now(),
    updatedAt: doc.updatedAt || Date.now(),
    deletedAt: Date.now(),
    delta: delta ?? null
  };
  trash.push(item);
  saveTrash(trash);
  return true;
}

export function purgeExpiredTrash(): TrashItem[] {
  const trash = loadTrash();
  const now = Date.now();
  const kept = trash.filter(t => (t.deletedAt || now) + TRASH_RETENTION_MS > now);
  if (kept.length !== trash.length) {
    // Remove deltas for items that expired.
    const expired = trash.filter(t => !kept.includes(t));
    expired.forEach(t => {
      try { removeDelta(t.id); } catch {}
    });
    saveTrash(kept);
  }
  return kept;
}

export function restoreFromArchive(id: string): boolean {
  const trash = loadTrash();
  const item = trash.find(t => t.id === id);
  if (!item) return false;

  const idx = loadIndex();
  let newId = item.id;
  if (idx.some(d => d.id === newId)) newId = "d_" + Date.now() + "_" + generateId();

  idx.push({
    id: newId,
    title: item.title || 'Untitled',
    createdAt: item.createdAt || Date.now(),
    updatedAt: Date.now()
  });
  saveIndex(idx);

  try {
    if (item.delta) {
      // Write under the new ID.
      window.localStorage.setItem(getContentKey(newId), item.delta);
    }
  } catch {}

  trash.splice(trash.indexOf(item), 1);
  saveTrash(trash);
  return true;
}

export function permanentlyDeleteFromArchive(id: string): boolean {
  const trash = loadTrash();
  const item = trash.find(t => t.id === id);
  if (!item) return false;

  trash.splice(trash.indexOf(item), 1);
  saveTrash(trash);
  removeDelta(id);
  return true;
}

// Legacy keys (migration from earlier single-document builds)
const LEGACY_DELTA_KEY = 'apollo_docs_draft_delta_v1';
const LEGACY_TITLE_KEY = 'apollo_docs_draft_title_v1';

/**
 * Migrates legacy single-document storage keys into the multi-document index.
 * Returns true if a migration happened.
 */
export function migrateLegacyIfNeeded(): boolean {
  if (typeof window === 'undefined') return false;
  const idx = loadIndex();
  if (idx.length) return false;

  try {
    const rawDelta = window.localStorage.getItem(LEGACY_DELTA_KEY);
    const rawTitle = window.localStorage.getItem(LEGACY_TITLE_KEY);
    if (!rawDelta) return false;

    const doc = createDoc('Apollo Document');
    if (rawTitle) {
      const t = rawTitle.toString().trim().slice(0, 120);
      if (t) updateDocMeta(doc.id, { title: t });
    }

    window.localStorage.setItem(getContentKey(doc.id), rawDelta);
    return true;
  } catch {
    return false;
  }
}
