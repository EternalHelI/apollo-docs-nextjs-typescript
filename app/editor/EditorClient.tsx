'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Brand } from '@/components/Brand';
import { SkipLink } from '@/components/SkipLink';
import { SiteFooter } from '@/components/SiteFooter';
import { ToastHost } from '@/components/ToastHost';

import { useMenus } from '@/lib/hooks/useMenus';
import { usePageLoader } from '@/lib/hooks/usePageLoader';
import { usePrivateModeWarning } from '@/lib/hooks/usePrivateModeWarning';
import { useThemeMode } from '@/lib/hooks/useTheme';
import { useToast } from '@/lib/hooks/useToast';

import type { DocMeta } from '@/lib/types';
import { createDoc, ensureDocMeta, migrateLegacyIfNeeded, setDocTitle, touchDoc } from '@/lib/docsStore';
import { loadDeltaRaw, loadWordCountEnabled, saveDeltaRaw, storeWordCountEnabled } from '@/lib/storage';
import { downloadBlob, fmtTime, safeFilename } from '@/lib/utils';
import { loadScriptOnce } from '@/lib/externalScripts';

type StatusTone = 'neutral' | 'ok' | 'warn' | 'err';

function statusClass(tone: StatusTone): string {
  switch (tone) {
    case 'ok': return 'status status--good';
    case 'warn': return 'status status--warn';
    case 'err': return 'status status--bad';
    default: return 'status status--neutral';
  }
}

export default function EditorClient(props: { initialId?: string }) {
  usePageLoader();
  useMenus();
  usePrivateModeWarning();

  const router = useRouter();
  const requestedId = (typeof props.initialId === 'string' && props.initialId.trim()) ? props.initialId : null;

  const { isDark, toggleTheme, toggleLabel: themeLabel } = useThemeMode();
  const toast = useToast();

  const editorElRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const dotsTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [title, setTitle] = useState('Apollo Document');
  const [status, setStatus] = useState<{ tone: StatusTone; text: string }>({ tone: 'neutral', text: 'Loading…' });
  const [wordCountEnabled, setWordCountEnabled] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Resolve docId: migrate legacy single doc if needed, then ensure meta exists.
  useEffect(() => {
    if (!requestedId) return;
    try { migrateLegacyIfNeeded(); } catch {}

    const meta = ensureDocMeta(requestedId);
    setDoc(meta);
    setTitle(meta.title || 'Apollo Document');
  }, [requestedId]);

  // If no id was provided, create a new doc and push.
  useEffect(() => {
    if (requestedId) return;
    try {
      const meta = createDoc('Apollo Document');
      router.replace(`/editor?id=${encodeURIComponent(meta.id)}`);
    } catch {
      router.replace('/homepage');
    }
  }, [requestedId, router]);

  // Word count preference.
  useEffect(() => {
    setWordCountEnabled(loadWordCountEnabled());
  }, []);

  const scheduleStatusReset = useCallback(() => {
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => {
      setStatus({ tone: 'neutral', text: 'Ready.' });
      statusTimerRef.current = null;
    }, 1200);
  }, []);

  const setStatusNow = useCallback((text: string, tone: StatusTone = 'neutral') => {
    setStatus({ text, tone });
    if (tone === 'ok') scheduleStatusReset();
  }, [scheduleStatusReset]);

  const stopDots = useCallback(() => {
    if (dotsTimerRef.current) {
      window.clearTimeout(dotsTimerRef.current);
      dotsTimerRef.current = null;
    }
  }, []);

  const startDots = useCallback((base: string) => {
    stopDots();
    let i = 0;
    const tick = () => {
      i = (i + 1) % 4;
      setStatus({ tone: 'neutral', text: base + '.'.repeat(i) });
      dotsTimerRef.current = window.setTimeout(tick, 350);
    };
    tick();
  }, [stopDots]);

  const computeWordCount = useCallback(() => {
    const q = quillRef.current;
    if (!q) return;
    try {
      const text: string = (q.getText?.() ?? '').trim();
      if (!text) return setWordCount(0);
      const words = text.split(/\s+/g).filter(Boolean).length;
      setWordCount(words);
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((mode: 'auto' | 'manual' | 'load' = 'auto') => {
    const q = quillRef.current;
    const meta = doc;
    if (!q || !meta) return;

    try {
      setStatusNow(mode === 'manual' ? 'Saving…' : 'Autosaving…', 'neutral');
      const delta = q.getContents?.();
      const raw = JSON.stringify(delta ?? { ops: [] });
      saveDeltaRaw(meta.id, raw);
      try { touchDoc(meta.id); } catch {}
      setStatusNow('Saved.', 'ok');
    } catch {
      setStatusNow('Save failed.', 'err');
    }
  }, [doc, setStatusNow]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      persist('auto');
    }, 450);
  }, [persist]);

  const loadSaved = useCallback(() => {
    const meta = doc;
    const q = quillRef.current;
    if (!meta || !q) return;

    try {
      const raw = loadDeltaRaw(meta.id);
      if (raw) {
        q.setContents(JSON.parse(raw));
        setStatusNow('Saved version loaded.', 'ok');
        computeWordCount();
        return;
      }
      setStatusNow('Nothing saved yet.', 'warn');
    } catch {
      setStatusNow('Load failed.', 'err');
    }
  }, [computeWordCount, doc, setStatusNow]);

  const setWordCountPref = useCallback((enabled: boolean) => {
    setWordCountEnabled(enabled);
    storeWordCountEnabled(enabled);
    if (enabled) window.setTimeout(computeWordCount, 0);
  }, [computeWordCount]);

  // Quill init + wiring.
  useEffect(() => {
    if (!doc || !editorElRef.current) return;
    if (initializedRef.current) return;

    initializedRef.current = true;

    const run = async () => {
      try {
        startDots('Loading editor');
        await loadScriptOnce('https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.min.js', () => window.Quill);
        stopDots();

        const Quill = window.Quill;
        if (!Quill) throw new Error('Quill failed to load');

        const q = new Quill(editorElRef.current!, {
          theme: 'snow',
          modules: { toolbar: '#toolbar' },
          placeholder: 'Start writing…'
        });

        quillRef.current = q;

        // Restore saved delta (if present)
        try {
          const raw = loadDeltaRaw(doc.id);
          if (raw) q.setContents(JSON.parse(raw));
        } catch {
          // ignore
        }

        computeWordCount();
        setStatusNow('Ready.', 'neutral');

        // Autosave on user edits
        q.on('text-change', (_delta: any, _old: any, source: string) => {
          if (source !== 'user') return;
          if (wordCountEnabled) window.requestIdleCallback?.(() => computeWordCount());
          scheduleAutosave();
        });

      } catch {
        stopDots();
        setStatusNow('Editor failed to load.', 'err');
      }
    };

    void run();
  }, [computeWordCount, doc, scheduleAutosave, setStatusNow, startDots, stopDots, wordCountEnabled]);

  // Ctrl/Cmd+S manual save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 's') {
        e.preventDefault();
        persist('manual');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persist]);

  // Keep title in sync with doc meta
  const onTitleBlur = useCallback(() => {
    if (!doc) return;
    try { setDocTitle(doc.id, title || 'Apollo Document'); } catch {}
  }, [doc, title]);

  const goHome = useCallback(() => {
    router.push('/homepage');
  }, [router]);

  // --- Save As helpers ---
  const closeSaveAsMenu = useCallback((animate = true) => {
    const menu = document.getElementById('menuSaveAs') as HTMLElement | null;
    const btn = document.getElementById('btnSaveAs') as HTMLButtonElement | null;
    if (!menu || !btn) return;

    btn.setAttribute('aria-expanded', 'false');

    if (!menu.hidden && animate) {
      menu.classList.remove('open');
      menu.classList.add('closing');
      window.setTimeout(() => {
        try {
          menu.hidden = true;
          menu.classList.remove('closing');
        } catch {}
      }, 200);
    } else {
      menu.classList.remove('open', 'closing');
      menu.hidden = true;
    }
  }, []);

  const openSaveAsMenu = useCallback(() => {
    const menu = document.getElementById('menuSaveAs') as HTMLElement | null;
    const btn = document.getElementById('btnSaveAs') as HTMLButtonElement | null;
    if (!menu || !btn) return;

    menu.hidden = false;
    menu.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }, []);

  const toggleSaveAsMenu = useCallback(() => {
    const menu = document.getElementById('menuSaveAs') as HTMLElement | null;
    if (!menu) return;
    if (menu.hidden) openSaveAsMenu(); else closeSaveAsMenu();
  }, [closeSaveAsMenu, openSaveAsMenu]);

  // --- Export ---
  const saveAsJson = useCallback(() => {
    if (!doc) return;
    try {
      const q = quillRef.current;
      const payload = {
        version: 1,
        id: doc.id,
        title: title || 'Apollo Document',
        savedAt: new Date().toISOString(),
        delta: q?.getContents?.() ?? { ops: [] },
        html: q?.root?.innerHTML ?? '',
        text: q?.getText?.() ?? ''
      };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeFilename(title, 'json'));
      setStatusNow(`Saved As JSON @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      setStatusNow('Save As failed.', 'err');
    }
  }, [doc, setStatusNow, title]);

  const getPrintableContainer = useCallback(() => {
    const wrapper = document.createElement('div');
    wrapper.style.background = '#ffffff';
    wrapper.style.color = '#0a0c12';
    wrapper.style.padding = '40px';
    wrapper.style.fontFamily = 'Roboto, Arial, sans-serif';
    wrapper.style.maxWidth = '900px';
    wrapper.style.margin = '0 auto';
    wrapper.innerHTML = quillRef.current ? (quillRef.current.root?.innerHTML ?? '') : '';
    return wrapper;
  }, []);

  const exportPDF = useCallback(async () => {
    try {
      startDots('Preparing PDF');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js', () => window.html2pdf);
      stopDots();

      setStatusNow('Exporting PDF…', 'warn');
      const filename = safeFilename(title, 'pdf');
      await window.html2pdf().set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(getPrintableContainer()).save();

      setStatusNow(`PDF exported @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      stopDots();
      setStatusNow('PDF export failed.', 'err');
    }
  }, [getPrintableContainer, setStatusNow, startDots, stopDots, title]);

  const exportDOCX = useCallback(async () => {
    try {
      startDots('Preparing DOCX');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.js', () => window.htmlDocx);
      stopDots();

      const htmlBody = quillRef.current ? (quillRef.current.root?.innerHTML ?? '') : '';
      const docHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
      downloadBlob(window.htmlDocx.asBlob(docHtml), safeFilename(title, 'docx'));
      setStatusNow(`DOCX exported @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      stopDots();
      setStatusNow('DOCX export failed.', 'err');
    }
  }, [setStatusNow, startDots, stopDots, title]);

  const exportODT = useCallback(async () => {
    try {
      startDots('Preparing ODT');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', () => window.JSZip);
      stopDots();

      const q = quillRef.current;
      const text: string = q ? (q.getText?.() ?? '') : '';
      const paras = text.split('\n').map(t => t.trim()).filter(Boolean);
      const escapeXml = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const contentXml = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">\n <office:body><office:text>\n  ${paras.map(p => `<text:p>${escapeXml(p)}</text:p>`).join('\n  ')}\n </office:text></office:body>\n</office:document-content>`;

      const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.2"><office:styles/></office:document-styles>`;

      const metaXml = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2">\n <office:meta><meta:generator>Apollo Documents</meta:generator></office:meta>
</office:document-meta>`;

      const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">\n <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>\n <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>\n <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>\n <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>\n</manifest:manifest>`;

      const zip = new window.JSZip();
      zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
      zip.file('content.xml', contentXml);
      zip.file('styles.xml', stylesXml);
      zip.file('meta.xml', metaXml);
      zip.folder('META-INF').file('manifest.xml', manifestXml);

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, safeFilename(title, 'odt'));
      setStatusNow(`ODT exported @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      stopDots();
      setStatusNow('ODT export failed.', 'err');
    }
  }, [setStatusNow, startDots, stopDots, title]);

  const onPrint = useCallback(async () => {
    try {
      const q = quillRef.current;
      const contentHtml = (q && q.root) ? q.root.innerHTML : '';

      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'Print');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const printDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!printDoc) { try { iframe.remove(); } catch {} ; return; }

      const printCss = `
        @page { size: Letter; margin: 1in; }
        html, body { background: #ffffff; color: #0a0c12; }
        body { margin: 0; }
        .ql-container { border: none !important; }
        .ql-editor{
          padding: 0 !important;
          font-family: "Inter", system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
          font-size: 12pt;
          line-height: 1.45;
        }
        .ql-editor, .ql-container, .ql-snow{ height: auto !important; max-height: none !important; overflow: visible !important; }
        img{ max-width: 100% !important; height: auto !important; }
        a{ color: inherit; text-decoration: underline; }
        pre, code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 10.5pt; }
      `;

      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Print</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css">
        <style>${printCss}</style>
      </head><body>
        <div class="ql-snow"><div class="ql-editor">${contentHtml}</div></div>
      </body></html>`;

      printDoc.open();
      printDoc.write(html);
      printDoc.close();

      const w = iframe.contentWindow;
      if (!w) { try { iframe.remove(); } catch {} ; return; }

      const cleanup = () => { try { iframe.remove(); } catch {} };

      const waitForImages = () => new Promise<void>((resolve) => {
        try {
          const imgs = Array.from(printDoc.images || []);
          if (imgs.length === 0) return resolve();
          let remaining = imgs.length;
          const done = () => { remaining -= 1; if (remaining <= 0) resolve(); };
          imgs.forEach((img) => {
            if ((img as HTMLImageElement).complete) return done();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          });
          setTimeout(resolve, 1200);
        } catch {
          resolve();
        }
      });

      await waitForImages();

      const onAfterPrint = () => cleanup();
      try { w.addEventListener('afterprint', onAfterPrint, { once: true }); } catch {}
      try { window.addEventListener('afterprint', onAfterPrint, { once: true }); } catch {}

      try { w.focus(); } catch {}
      w.print();
      setTimeout(cleanup, 4000);
    } catch {
      // ignore
    }
  }, []);

  const statusAria = useMemo(() => status.text, [status.text]);

  return (
    <>
      <SkipLink href="#main" label="Skip to content" />

      <header className="app-header">
        <div className="container app-header-inner">
          <Brand ariaLabel="Apollo Hub — Apollo Documents home" href="/homepage" />
          <div className="header-actions" />
        </div>
      </header>

      <main className="container editor-wrap" id="main">
        <div className="docbar" id="docbar">
          <div className="docbar-inner">
            <div className="docbar-left">
              <label className="sr-only" htmlFor="docTitle">Document Name</label>
              <input autoComplete="off" id="docTitle" type="text" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={onTitleBlur} />
              <div aria-live="polite" className={statusClass(status.tone)} id="status" role="status">{statusAria}</div>
            </div>

            <nav aria-label="Document actions" className="docbar-actions">
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
                  <div className="menu-label">Preferences
                    <div className="menu-sep" />
                  </div>

                  <button aria-pressed={isDark ? 'true' : 'false'} className="menu-item" id="toggleTheme" type="button" onClick={toggleTheme}>
                    <div className="menu-item-title">{themeLabel}</div>
                    <div className="menu-item-desc">Toggle light/dark theme</div>
                  </button>

                  <button aria-pressed={wordCountEnabled ? 'true' : 'false'} className="menu-item" id="toggleWordCount" type="button" onClick={() => setWordCountPref(!wordCountEnabled)}>
                    <div className="menu-item-title">Word count</div>
                    <div className="menu-item-desc">Show or hide word count</div>
                  </button>

                  <div className="menu-sep" />
                  <div className="menu-label">File</div>

                  <button className="menu-item" id="btnNew" type="button" onClick={goHome}>
                    <div className="menu-item-title">New</div>
                    <div className="menu-item-desc">Return to the documents list</div>
                  </button>

                  <button className="menu-item" id="btnSave" type="button" onClick={() => persist('manual')}>
                    <div className="menu-item-title">Save</div>
                    <div className="menu-item-desc">Manual snapshot (Ctrl/Cmd+S)</div>
                  </button>

                  <button className="menu-item" id="btnLoad" type="button" onClick={loadSaved}>
                    <div className="menu-item-title">Reload saved</div>
                    <div className="menu-item-desc">Restore last saved version</div>
                  </button>

                  <div className="menu-sep" />
                  <div className="menu-label">Quick actions</div>

                  <button aria-controls="menuSaveAs" aria-expanded="false" className="menu-item" id="btnSaveAs" type="button" onClick={toggleSaveAsMenu}>
                    <div className="menu-item-title">Save As</div>
                    <div className="menu-item-desc">Choose a download format</div>
                    <span aria-hidden="true" className="menu-item-caret">▸</span>
                  </button>

                  <div className="menu-subpanel" hidden id="menuSaveAs">
                    <button className="menu-item menu-item--sub" id="btnSaveAsJson" type="button" onClick={() => { try { saveAsJson(); } finally { closeSaveAsMenu(); } }}>
                      <div className="menu-item-title">JSON</div>
                      <div className="menu-item-desc">Snapshot of content + metadata</div>
                    </button>
                    <button className="menu-item menu-item--sub" id="btnSaveAsPdf" type="button" onClick={() => { void exportPDF().finally(() => closeSaveAsMenu()); }}>
                      <div className="menu-item-title">PDF</div>
                      <div className="menu-item-desc">Best visual fidelity</div>
                    </button>
                    <button className="menu-item menu-item--sub" id="btnSaveAsDocx" type="button" onClick={() => { void exportDOCX().finally(() => closeSaveAsMenu()); }}>
                      <div className="menu-item-title">DOCX</div>
                      <div className="menu-item-desc">Microsoft Word compatible</div>
                    </button>
                    <button className="menu-item menu-item--sub" id="btnSaveAsOdt" type="button" onClick={() => { void exportODT().finally(() => closeSaveAsMenu()); }}>
                      <div className="menu-item-title">ODT</div>
                      <div className="menu-item-desc">LibreOffice / OpenDocument</div>
                    </button>
                  </div>

                  <div className="menu-sep" />
                </div>
              </div>

              <button aria-label="Print" className="btn btn-print" id="btnPrint" title="Print document" type="button" onClick={() => void onPrint()}>
                <img alt="" aria-hidden="true" className="icon-print-img" height={16} src="/assets/print-svgrepo-com.svg" width={16} />
                <span className="btn-text">Print</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="toolstrip" id="toolstrip">
          <div className="toolstrip-inner">
            <div aria-label="Editor toolbar" id="toolbar" role="toolbar">
              <span className="ql-formats">
                <select aria-label="Heading" className="ql-header" defaultValue="">
                  <option value=""></option>
                  <option value="1"></option>
                  <option value="2"></option>
                  <option value="3"></option>
                </select>
                <select aria-label="Font size" className="ql-size" defaultValue="">
                  <option value="small"></option>
                  <option value=""></option>
                  <option value="large"></option>
                  <option value="huge"></option>
                </select>
              </span>
              <span className="ql-formats">
                <button aria-label="Bold" className="ql-bold"></button>
                <button aria-label="Italic" className="ql-italic"></button>
                <button aria-label="Underline" className="ql-underline"></button>
                <button aria-label="Strikethrough" className="ql-strike"></button>
              </span>
              <span className="ql-formats">
                <button aria-label="Numbered list" className="ql-list" value="ordered"></button>
                <button aria-label="Bullet list" className="ql-list" value="bullet"></button>
                <button aria-label="Decrease indent" className="ql-indent" value="-1"></button>
                <button aria-label="Increase indent" className="ql-indent" value="+1"></button>
              </span>
              <span className="ql-formats">
                <select aria-label="Alignment" className="ql-align"></select>
                <button aria-label="Insert link" className="ql-link"></button>
                <button aria-label="Clear formatting" className="ql-clean"></button>
              </span>
            </div>

            <div className="wordcount" hidden={!wordCountEnabled} id="wordCount">Words: {wordCount}</div>
          </div>
        </div>

        <section className="panel">
          <div id="editor" ref={editorElRef} tabIndex={-1} />
        </section>

        <ToastHost toastRef={toast.refs.toastRef} textRef={toast.refs.textRef} timerRef={toast.refs.timerRef} variant="danger" />
      </main>

      <SiteFooter />
    </>
  );
}
