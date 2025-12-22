import type { DocMeta, TrashItem } from '@/lib/types';
import {
  getContentKeyV2,
  loadContentV2Raw,
  loadIndex,
  loadTrash,
  removeContentV2,
  saveContentV2Raw,
  saveIndex,
  saveTrash
} from '@/lib/storage';
import { generateId } from '@/lib/utils';

// Default content for brand-new documents (TipTap JSON).
// Keep this simple and StarterKit-compatible.
export const DEFAULT_DOC_CONTENT_V2 = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Welcome to Apollo Documents' }]
    },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'This is a new document. Start typing below — Apollo will autosave as you work.' }
      ]
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Use the toolbar for headings and formatting.' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Press Ctrl/Cmd+S to force a manual snapshot.' }] }]
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Options → Save As exports JSON / PDF / DOCX / ODT.' }] }]
        }
      ]
    },
    { type: 'paragraph', content: [{ type: 'text', text: '' }] }
  ]
} as const;

export const DEFAULT_DOC_CONTENT_V2_RAW = JSON.stringify(DEFAULT_DOC_CONTENT_V2);

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
  const id = `d_${Date.now()}_${generateId()}`;
  const doc: DocMeta = { id, title, createdAt: Date.now(), updatedAt: Date.now() };
  idx.push(doc);
  saveIndex(idx);

  // Seed brand-new documents with an introductory message.
  // This keeps the first open consistent across Home → New and direct /editor.
  try {
    saveContentV2Raw(id, DEFAULT_DOC_CONTENT_V2_RAW);
  } catch {
    // ignore (private mode / storage disabled)
  }

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
  const contentV2 = loadContentV2Raw(docId);
  const item: TrashItem = {
    id: doc.id,
    title: doc.title || 'Untitled',
    createdAt: doc.createdAt || Date.now(),
    updatedAt: doc.updatedAt || Date.now(),
    deletedAt: Date.now(),
    contentV2: contentV2 ?? null
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
    const expired = trash.filter(t => !kept.includes(t));
    expired.forEach(t => {
      try { removeContentV2(t.id); } catch {}
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
  if (idx.some(d => d.id === newId)) newId = `d_${Date.now()}_${generateId()}`;

  idx.push({
    id: newId,
    title: item.title || 'Untitled',
    createdAt: item.createdAt || Date.now(),
    updatedAt: Date.now()
  });
  saveIndex(idx);

  try {
    if (item.contentV2) {
      window.localStorage.setItem(getContentKeyV2(newId), item.contentV2);
    }
  } catch {
    // ignore
  }

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
  removeContentV2(id);
  return true;
}
