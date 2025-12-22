'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Brand } from '@/components/Brand';
import { SkipLink } from '@/components/SkipLink';
import { SiteFooter } from '@/components/SiteFooter';

import { useMenus } from '@/lib/hooks/useMenus';
import { usePageLoader } from '@/lib/hooks/usePageLoader';
import { usePrivateModeWarning } from '@/lib/hooks/usePrivateModeWarning';
import { useThemeMode } from '@/lib/hooks/useTheme';
import { useChangelogViewMode } from '@/lib/hooks/useChangelogView';

import { CHANGELOGS } from '@/lib/changelogsData';
import type { ChangelogEntry } from '@/lib/changelogsData';
import { escapeHtml } from '@/lib/utils';

export default function ChangelogsPage() {
  usePageLoader();
  useMenus();
  usePrivateModeWarning();

  const { isDark, toggleTheme, toggleLabel: themeLabel } = useThemeMode();
  const { view, toggleView, toggleLabel: viewLabel, isList } = useChangelogViewMode();

  const [selected, setSelected] = useState<ChangelogEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);

  const openModal = useCallback((entry: ChangelogEntry) => {
    setSelected(entry);
    setModalClosing(false);
    setModalOpen(true);
    window.requestAnimationFrame(() => {
      const el = document.getElementById('changelogBackdrop');
      el?.classList.add('is-open');
      try { (document.getElementById('changelogCloseBtn') as HTMLButtonElement | null)?.focus(); } catch {}
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalClosing(true);
    const bd = document.getElementById('changelogBackdrop');
    bd?.classList.remove('is-open');
    bd?.classList.add('is-closing');
    window.setTimeout(() => {
      setModalClosing(false);
      setSelected(null);
      const el = document.getElementById('changelogBackdrop');
      el?.classList.remove('is-closing');
    }, 200);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (modalOpen || modalClosing)) closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeModal, modalClosing, modalOpen]);

  const modalHidden = !(modalOpen || modalClosing);

  const list = useMemo(() => {
    return CHANGELOGS.map((entry) => {
      const title = entry.title || entry.version;
      const desc = entry.summary || '';
      const dateLine = `${entry.date || ''}${entry.time ? ' • ' + entry.time : ''}`;
      return (
        <article className="changelog-row" key={entry.version}>
          <div className="changelog-left">
            <div className="changelog-dot" aria-hidden="true" />
            <div className="changelog-left-meta">
              <div className="changelog-version">{entry.version}</div>
              <div className="changelog-date">{dateLine}</div>
            </div>
          </div>

          <div className="changelog-right">
            <div className="changelog-row-title">{title}</div>
            <div className="changelog-row-desc">{desc}</div>
          </div>

          <div className="changelog-actions">
            <button className="btn btn-small" type="button" onClick={() => openModal(entry)}>Read more</button>
          </div>
        </article>
      );
    });
  }, [openModal]);

  const modalMeta = useMemo(() => {
    if (!selected) return '';
    const dateLine = `${selected.date || ''}${selected.time ? ' • ' + selected.time : ''}`;
    return `<span class="pill">${escapeHtml(selected.version)}</span><span class="pill pill-muted">${escapeHtml(dateLine)}</span>`;
  }, [selected]);

  const modalContent = useMemo(() => {
    if (!selected) return '';
    const sections = (selected.sections || []).map((sec) => {
      const items = (sec.items || []).map((it) => `<li>${escapeHtml(it)}</li>`).join('');
      return `<section class="changelog-section"><h3 class="changelog-section-title">${escapeHtml(sec.title)}</h3><ul class="changelog-section-list">${items}</ul></section>`;
    }).join('');
    return `<div class="changelog-modal-title">${escapeHtml(selected.title || selected.version)}</div><div class="changelog-modal-summary">${escapeHtml(selected.summary || '')}</div>${sections}`;
  }, [selected]);

  const timelineClass = useMemo(() => {
    return `changelog-timeline${view === 'grid' ? ' is-grid' : ''}`;
  }, [view]);

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

                <button aria-pressed={isList ? 'true' : 'false'} className="menu-item" id="toggleView" type="button" onClick={toggleView}>
                  <div className="menu-item-title">{viewLabel}</div>
                  <div className="menu-item-desc">Switch changelog layout</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container page" id="main">
        <section className="panel changelog-panel">
          <div className="panel-header">
            <h1 className="panel-title">Changelog</h1>
            <p className="panel-subtitle">Release notes and version history for Apollo Documents.</p>
          </div>

          <div aria-live="polite" className={timelineClass} id="changelogList">
            {list}
          </div>
        </section>
      </main>

      <SiteFooter />

      <div className="modal-backdrop" hidden={modalHidden} id="changelogBackdrop" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
        <div aria-describedby="changelogModalDesc" aria-labelledby="changelogModalTitle" aria-modal="true" className="modal modal-wide" role="dialog">
          <div className="modal-header">
            <div className="modal-title" id="changelogModalTitle">Release details</div>
            <button aria-label="Close dialog" className="icon-btn" id="changelogModalClose" type="button" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            <div className="changelog-modal-meta" id="changelogModalDesc" dangerouslySetInnerHTML={{ __html: modalMeta }} />
            <div className="changelog-modal-content" id="changelogModalContent" dangerouslySetInnerHTML={{ __html: modalContent }} />
          </div>
          <div className="modal-actions">
            <button className="btn" id="changelogCloseBtn" type="button" onClick={closeModal}>Close</button>
          </div>
        </div>
      </div>
    </>
  );
}
