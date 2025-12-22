'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Brand } from '@/components/Brand';
import { SkipLink } from '@/components/SkipLink';
import { SiteFooter } from '@/components/SiteFooter';
import { ToastHost } from '@/components/ToastHost';

import type { DocMeta } from '@/lib/types';
import { useMenus } from '@/lib/hooks/useMenus';
import { usePageLoader } from '@/lib/hooks/usePageLoader';
import { usePrivateModeWarning } from '@/lib/hooks/usePrivateModeWarning';
import { useDocsViewMode } from '@/lib/hooks/useDocsView';
import { useThemeMode } from '@/lib/hooks/useTheme';
import { useToast } from '@/lib/hooks/useToast';

import { moveToArchive, openDocUrl, createDoc, migrateLegacyIfNeeded, purgeExpiredTrash, setDocTitle } from '@/lib/docsStore';
import { loadIndex } from '@/lib/storage';
import { escapeHtml, fmtTime, safeText } from '@/lib/utils';

export default function Homepage() {
  usePageLoader();
  useMenus();
  usePrivateModeWarning();

  const router = useRouter();
  const toast = useToast();
  const { view, toggleView, toggleLabel: viewLabel, isList } = useDocsViewMode();
  const { isDark, toggleTheme, toggleLabel: themeLabel } = useThemeMode();

  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('');

  const reload = useCallback(() => {
    purgeExpiredTrash();
    migrateLegacyIfNeeded();
    const idx = loadIndex().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setDocs(idx);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onCreate = useCallback(() => {
    const meta = createDoc('Apollo Document');
    router.push(openDocUrl(meta.id));
  }, [router]);

  const onOpen = useCallback((id: string) => {
    router.push(openDocUrl(id));
  }, [router]);

  const onArchive = useCallback((id: string) => {
    const doc = docs.find(d => d.id === id);
    if (!doc) return;
    const ok = moveToArchive(id);
    if (!ok) return;

    toast.show(`Moving <strong>“${escapeHtml(doc.title || 'Untitled')}”</strong> to Archive`);
    setEditingId(null);
    reload();
  }, [docs, reload, toast]);

  const startRename = useCallback((doc: DocMeta) => {
    setEditingId(doc.id);
    setDraftTitle(doc.title || 'Apollo Document');
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const next = (draftTitle || '').trim().slice(0, 120);
    const doc = docs.find(d => d.id === editingId);
    if (!doc) {
      setEditingId(null);
      return;
    }

    if (!next || next === (doc.title || '').trim()) {
      setEditingId(null);
      return;
    }

    const ok = setDocTitle(editingId, next);
    if (!ok) {
      setEditingId(null);
      return;
    }

    setEditingId(null);
    reload();
  }, [docs, draftTitle, editingId, reload]);

  const docsClass = useMemo(() => (isList ? 'docs-list' : 'docs-grid'), [isList]);

  return (
    <>
      <SkipLink href="#main" label="Skip to content" />

      <header className="app-header">
        <div className="container app-header-inner">
          <Brand ariaLabel="Apollo Hub — Apollo Documents home" href="/homepage" />

          <div aria-label="Page actions" className="header-actions">
            <Link className="btn btn-archive" href="/archive" id="btnTrash" title="View Archive">
              <img alt="" aria-hidden="true" className="icon-trash-img" height={16} src="/assets/trash-svgrepo-com.svg" width={16} />
              <span className="btn-text">Archive</span>
            </Link>

            <div className="menu" data-menu="info">
              <button aria-expanded="false" aria-haspopup="true" aria-label="Info" className="btn menu-trigger" id="triggerInfo" title="Info" type="button">
                <img alt="" aria-hidden="true" className="icon-info-img" height={16} width={16} src="/assets/info-circle-svgrepo-com.svg" />
                <span className="trigger-text">Info</span>
                <span aria-hidden="true" className="caret">▾</span>
              </button>
              <div aria-labelledby="triggerInfo" className="menu-panel" hidden id="menuInfo" role="menu">
                <div className="menu-label">
                  Info
                  <div className="menu-sep" />
                  <Link className="menu-item menu-link" href="/changelogs">
                    <div className="menu-item-title">Changelog</div>
                    <div className="menu-item-desc">Version history and updates</div>
                  </Link>
                </div>
                <button className="menu-item" id="btnSocials" type="button" onClick={() => toast.show('Socials is coming soon.', 4)}>
                  <div className="menu-item-title">Socials</div>
                  <div className="menu-item-desc">Coming soon</div>
                </button>
              </div>
            </div>

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

                <button aria-pressed={isList ? 'true' : 'false'} className="menu-item" id="toggleView" type="button" onClick={toggleView}>
                  <div className="menu-item-title">{viewLabel}</div>
                  <div className="menu-item-desc">Switch document layout</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ToastHost toastRef={toast.refs.toastRef} textRef={toast.refs.textRef} timerRef={toast.refs.timerRef} />

      <main className="container" id="main">
        <section className="docs-hero">
          <h1 className="docs-title">Your documents</h1>
          <p className="docs-subtitle">Open a document to load the editor. This page stays fast, and gives the editor time to load when needed.</p>
        </section>

        <div className="empty" hidden={docs.length > 0} id="emptyState">No documents yet. Create your first document to get started.</div>

        <section aria-label="Document list" className={docsClass} id="docsGrid">
          <article className="doc-card card-new">
            <div className="doc-title">
              <img className="doc-icon" src="/assets/document-text-svgrepo-com.svg" alt="" aria-hidden="true" width={16} height={16} draggable={false} />
              <span className="doc-title-text">New Document</span>
              <span className="pill">Fast</span>
            </div>
            <div className="doc-meta">Create a new document and open the editor</div>
            <div className="doc-actions">
              <button className="btn btn-primary" type="button" onClick={onCreate}>Create</button>
            </div>
          </article>

          {docs.map((doc) => {
            const isEditing = editingId === doc.id;
            return (
              <article className="doc-card" key={doc.id}>
                <div
                  className="doc-title"
                  data-docid={doc.id}
                  title={isEditing ? 'Rename document' : 'Double-click to rename'}
                  onDoubleClick={() => startRename(doc)}
                >
                  <img className="doc-icon" src="/assets/document-text-svgrepo-com.svg" alt="" aria-hidden="true" width={16} height={16} draggable={false} />
                  {isEditing ? (
                    <input
                      className="doc-title-input"
                      type="text"
                      value={draftTitle}
                      aria-label="Rename document"
                      autoComplete="off"
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditingId(null);
                        }
                      }}
                      onBlur={commitRename}
                      autoFocus
                    />
                  ) : (
                    <span className="doc-title-text" dangerouslySetInnerHTML={{ __html: safeText(doc.title || 'Untitled') }} />
                  )}
                </div>
                <div className="doc-meta">Updated: {fmtTime(doc.updatedAt || doc.createdAt || Date.now())}</div>
                <div className="doc-actions">
                  <button className="btn btn-primary" type="button" onClick={() => onOpen(doc.id)}>Open</button>
                  <button
                    className="btn btn-icon btn-icon-danger"
                    type="button"
                    aria-label="Move to Archive"
                    title="Move to Archive"
                    onClick={() => onArchive(doc.id)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M18 6V16.2C18 17.8802 18 18.7202 17.673 19.362C17.3854 19.9265 16.9265 20.3854 16.362 20.673C15.7202 21 14.8802 21 13.2 21H10.8C9.11984 21 8.27976 21 7.63803 20.673C7.07354 20.3854 6.6146 19.9265 6.32698 19.362C6 18.7202 6 17.8802 6 16.2V6M14 10V17M10 10V17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
