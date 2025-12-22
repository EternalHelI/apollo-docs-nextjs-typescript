'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Brand } from '@/components/Brand';
import { SkipLink } from '@/components/SkipLink';
import { SiteFooter } from '@/components/SiteFooter';
import { ToastHost } from '@/components/ToastHost';

import type { TrashItem } from '@/lib/types';
import { useMenus } from '@/lib/hooks/useMenus';
import { usePageLoader } from '@/lib/hooks/usePageLoader';
import { usePrivateModeWarning } from '@/lib/hooks/usePrivateModeWarning';
import { useThemeMode } from '@/lib/hooks/useTheme';
import { useToast } from '@/lib/hooks/useToast';

import { TRASH_RETENTION_MS, purgeExpiredTrash, restoreFromArchive, permanentlyDeleteFromArchive } from '@/lib/docsStore';
import { fmtTime, escapeHtml } from '@/lib/utils';

function msLeft(deletedAt: number | undefined): number {
  const now = Date.now();
  const end = (deletedAt || now) + TRASH_RETENTION_MS;
  return Math.max(0, end - now);
}

function fmtRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${days}d ${pad2(hours)}h ${pad2(mins)}m ${pad2(secs)}s`;
}

export default function ArchivePage() {
  usePageLoader();
  useMenus();
  usePrivateModeWarning();

  const toast = useToast();
  const { isDark, toggleTheme, toggleLabel: themeLabel } = useThemeMode();

  const [items, setItems] = useState<TrashItem[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string>('this document');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  const reload = useCallback(() => {
    const kept = purgeExpiredTrash().slice().sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
    setItems(kept);
  }, []);

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    reload();
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (items.some(i => msLeft(i.deletedAt) <= 0)) reload();
  }, [items, now, reload]);

  const onRestore = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const ok = restoreFromArchive(id);
    if (!ok) return;

    toast.show(`Restored <strong>“${escapeHtml(item.title || 'Untitled')}”</strong>`);
    reload();
  }, [items, reload, toast]);

  const openDeleteModal = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    setDeleteId(id);
    setDeleteTitle(item.title || 'this document');

    setModalClosing(false);
    setModalOpen(true);
    window.requestAnimationFrame(() => {
      const el = document.getElementById('deleteBackdrop');
      el?.classList.add('is-open');
      try { (document.getElementById('deleteConfirm') as HTMLButtonElement | null)?.focus(); } catch {}
    });
  }, [items]);

  const closeDeleteModal = useCallback(() => {
    setModalOpen(false);
    setModalClosing(true);
    const backdrop = document.getElementById('deleteBackdrop');
    backdrop?.classList.remove('is-open');
    backdrop?.classList.add('is-closing');
    window.setTimeout(() => {
      setModalClosing(false);
      setDeleteId(null);
      const bd = document.getElementById('deleteBackdrop');
      bd?.classList.remove('is-closing');
    }, 200);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteId) return;
    const item = items.find(i => i.id === deleteId);

    const ok = permanentlyDeleteFromArchive(deleteId);
    if (!ok) return;

    toast.show(`Deleted <strong>“${escapeHtml(item?.title || 'Untitled')}”</strong> forever`, 6);
    closeDeleteModal();
    reload();
  }, [closeDeleteModal, deleteId, items, reload, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (modalOpen || modalClosing)) closeDeleteModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeDeleteModal, modalClosing, modalOpen]);

  const empty = items.length === 0;

  const modalHidden = !(modalOpen || modalClosing);

  const list = useMemo(() => {
    return items.map(item => {
      const remain = fmtRemaining(msLeft(item.deletedAt));
      return (
        <article className="doc-card" key={item.id}>
          <div className="doc-title">
            <img className="doc-icon" src="/assets/document-text-svgrepo-com.svg" alt="" aria-hidden="true" width={16} height={16} draggable={false} />
            <span className="doc-title-text">{item.title || 'Untitled'}</span>
          </div>
          <div className="doc-meta">
            Archived: {fmtTime(item.deletedAt || Date.now())} • <span className="pill-muted" data-countdown={item.deletedAt || Date.now()}>{remain} left</span>
          </div>
          <div className="doc-actions">
            <button className="btn btn-primary" type="button" onClick={() => onRestore(item.id)}>Restore</button>
            <button className="btn btn-icon btn-icon-danger" type="button" aria-label="Delete permanently" title="Delete permanently" onClick={() => openDeleteModal(item.id)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M18 6V16.2C18 17.8802 18 18.7202 17.673 19.362C17.3854 19.9265 16.9265 20.3854 16.362 20.673C15.7202 21 14.8802 21 13.2 21H10.8C9.11984 21 8.27976 21 7.63803 20.673C7.07354 20.3854 6.6146 19.9265 6.32698 19.362C6 18.7202 6 17.8802 6 16.2V6M14 10V17M10 10V17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </article>
      );
    });
  }, [items, onRestore, openDeleteModal, now]);

  return (
    <>
      <SkipLink href="#main" label="Skip to content" />

      <header className="app-header">
        <div className="container app-header-inner">
          <Brand ariaLabel="Apollo Hub — Apollo Documents home" href="/homepage" />

          <div aria-label="Page actions" className="header-actions">
            <Link aria-label="Home" className="btn btn-home" href="/homepage" id="btnHome" title="Home">
              <img alt="" aria-hidden="true" className="icon-home-img" height={16} src="/assets/house-line-svgrepo-com.svg" width={16} />
              <span className="btn-text">Home</span>
            </Link>

            <div className="menu" data-menu="settings">
              <button aria-expanded="false" aria-haspopup="true" aria-label="Options" className="btn menu-trigger" id="triggerSettings" title="Options" type="button">
                <img alt="" aria-hidden="true" className="icon-gear-img" height={16} src="/assets/gear-svgrepo-com.svg" width={16} />
                <span className="trigger-text">Options</span>
                <span aria-hidden="true" className="caret">▾</span>
              </button>
              <div aria-labelledby="triggerSettings" className="menu-panel" hidden id="menuSettings" role="menu">
                <div className="menu-label">
                  Preferences
                  <div className="menu-sep" />
                </div>
                <button aria-pressed={isDark ? 'true' : 'false'} className="menu-item" id="toggleTheme" type="button" onClick={toggleTheme}>
                  <div className="menu-item-title">{themeLabel}</div>
                  <div className="menu-item-desc">Toggle light/dark theme</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ToastHost toastRef={toast.refs.toastRef} textRef={toast.refs.textRef} timerRef={toast.refs.timerRef} />

      <main className="container" id="main">
        <section className="docs-hero">
          <h1 className="docs-title">Archive</h1>
          <p className="docs-subtitle">Archived documents stay here for 30 days. Restore if needed, or delete permanently.</p>
        </section>

        <div className="empty" hidden={!empty} id="trashEmpty">Your Archive is empty.</div>

        <section aria-label="Trashed documents" className="docs-list" id="trashList">
          {list}
        </section>
      </main>

      <SiteFooter />

      <div className="modal-backdrop" hidden={modalHidden} id="deleteBackdrop" onClick={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
        <div aria-describedby="deleteModalDesc" aria-labelledby="deleteModalTitle" aria-modal="true" className="modal" role="dialog">
          <div className="modal-header">
            <div className="modal-title" id="deleteModalTitle">Delete forever?</div>
            <button aria-label="Close dialog" className="icon-btn" id="deleteModalClose" type="button" onClick={closeDeleteModal}>×</button>
          </div>
          <div className="modal-body">
            <p className="modal-text" id="deleteModalDesc">
              This will permanently delete <strong id="deleteDocName">{deleteTitle}</strong> from Archive.
              <span className="modal-sub">This action cannot be undone.</span>
            </p>
          </div>
          <div className="modal-actions">
            <button className="btn" id="deleteCancel" type="button" onClick={closeDeleteModal}>Cancel</button>
            <button className="btn btn-danger" id="deleteConfirm" type="button" onClick={confirmDelete}>Delete permanently</button>
          </div>
        </div>
      </div>
    </>
  );
}
