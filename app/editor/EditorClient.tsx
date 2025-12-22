'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

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
import { createDoc, ensureDocMeta, setDocTitle, touchDoc } from '@/lib/docsStore';
import { loadContentV2Raw, loadWordCountEnabled, saveContentV2Raw, storeWordCountEnabled } from '@/lib/storage';
import { downloadBlob, escapeHtml, fmtTime, safeFilename } from '@/lib/utils';
import { loadScriptOnce } from '@/lib/externalScripts';

type StatusTone = 'neutral' | 'ok' | 'warn' | 'err';

function statusClass(tone: StatusTone): string {
  switch (tone) {
    case 'ok': return 'status status--ok';
    case 'warn': return 'status status--warn';
    case 'err': return 'status status--err';
    default: return 'status';
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

  const autosaveTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);
  const hydratedForDocRef = useRef<string | null>(null);

  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [title, setTitle] = useState('Apollo Document');
  const [status, setStatus] = useState<{ tone: StatusTone; text: string }>({ tone: 'neutral', text: 'Loading…' });
  const [wordCountEnabled, setWordCountEnabled] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      LinkExtension.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Placeholder.configure({ placeholder: 'Start writing…' })
    ],
    editorProps: {
      attributes: {
        id: 'editor',
        class: 'apollo-editor apollo-page-guides tiptap'
      }
    },
    content: '<p></p>'
  });

  // Resolve docId: ensure metadata exists.
  useEffect(() => {
    if (!requestedId) return;
    const meta = ensureDocMeta(requestedId);
    setDoc(meta);
    setTitle(meta.title || 'Apollo Document');
    setStatus({ tone: 'neutral', text: 'Loading…' });
  }, [requestedId]);

  // If no id was provided, create a new doc and push.
  useEffect(() => {
    if (requestedId) return;
    try {
      const meta = createDoc('Apollo Document');
      // Keep the editor usable even if the route doesn't remount immediately.
      setDoc(meta);
      setTitle(meta.title || 'Apollo Document');
      setStatus({ tone: 'neutral', text: 'Loading…' });
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

  const computeWordCount = useCallback(() => {
    if (!editor) return;
    try {
      const text = (editor.getText() || '').trim();
      if (!text) { setWordCount(0); return; }
      const words = text.split(/\s+/g).filter(Boolean).length;
      setWordCount(words);
    } catch {
      // ignore
    }
  }, [editor]);

  const persist = useCallback((mode: 'auto' | 'manual' = 'auto') => {
    if (!doc || !editor) return;
    try {
      setStatusNow(mode === 'manual' ? 'Saving…' : 'Autosaving…', 'neutral');
      const json = editor.getJSON();
      saveContentV2Raw(doc.id, JSON.stringify(json));
      try { touchDoc(doc.id); } catch {}
      setStatusNow('Saved.', 'ok');
    } catch {
      setStatusNow('Save failed.', 'err');
    }
  }, [doc, editor, setStatusNow]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      persist('auto');
    }, 450);
  }, [persist]);

  // Load content for this doc.
  useEffect(() => {
    if (!doc || !editor) return;
    if (hydratedForDocRef.current === doc.id) return;
    hydratedForDocRef.current = doc.id;
    try {
      setStatusNow('Loading…', 'neutral');

      const rawV2 = loadContentV2Raw(doc.id);
      if (rawV2) {
        try {
          editor.commands.setContent(JSON.parse(rawV2));
        } catch {
          // Corrupted payload — recover to a blank document so the editor stays usable.
          editor.commands.setContent('<p></p>');
          setStatusNow('Recovered from corrupted content.', 'warn');
        }
      } else {
        // New document (or cleared storage)
        editor.commands.setContent('<p></p>');
      }

      computeWordCount();
      // Ensure we never leave the status stuck on a loading string.
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
      setStatusNow('Ready.', 'neutral');
    } catch {
      setStatusNow('Editor failed to load.', 'err');
    }
  }, [computeWordCount, doc, editor, setStatusNow]);

  // Autosave on user edits
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (wordCountEnabled) {
        const idle = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
        if (typeof idle === 'function') idle(() => computeWordCount()); else computeWordCount();
      }
      scheduleAutosave();
    };

    editor.on('update', handler);
    return () => {
      try { editor.off('update', handler); } catch {}
    };
  }, [computeWordCount, editor, scheduleAutosave, wordCountEnabled]);

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

  const setWordCountPref = useCallback((enabled: boolean) => {
    setWordCountEnabled(enabled);
    storeWordCountEnabled(enabled);
    if (enabled) window.setTimeout(computeWordCount, 0);
  }, [computeWordCount]);

  // --- Save As helpers (nested subpanel) ---
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

  // --- Export helpers ---
  const getEditorHtml = useCallback(() => {
    try { return editor ? (editor.getHTML?.() || '') : ''; } catch { return ''; }
  }, [editor]);

  const getEditorText = useCallback(() => {
    try { return editor ? (editor.getText?.() || '') : ''; } catch { return ''; }
  }, [editor]);

  const saveAsJson = useCallback(() => {
    if (!doc) return;
    try {
      const payload = {
        version: 2,
        id: doc.id,
        title: title || 'Apollo Document',
        savedAt: new Date().toISOString(),
        tiptap: editor ? editor.getJSON() : null,
        html: getEditorHtml(),
        text: getEditorText()
      };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), safeFilename(title, 'json'));
      setStatusNow(`Saved As JSON @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      setStatusNow('Save As failed.', 'err');
    }
  }, [doc, editor, getEditorHtml, getEditorText, setStatusNow, title]);

  const getPrintableContainer = useCallback(() => {
    const wrapper = document.createElement('div');
    wrapper.style.background = '#ffffff';
    wrapper.style.color = '#0a0c12';
    wrapper.style.padding = '40px';
    wrapper.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    wrapper.style.maxWidth = '900px';
    wrapper.style.margin = '0 auto';
    wrapper.innerHTML = getEditorHtml();
    return wrapper;
  }, [getEditorHtml]);

  const exportPDF = useCallback(async () => {
    try {
      setStatusNow('Preparing PDF…', 'neutral');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js', () => (window as any).html2pdf);
      setStatusNow('Exporting PDF…', 'warn');
      const filename = safeFilename(title, 'pdf');
      await (window as any).html2pdf().set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(getPrintableContainer()).save();

      setStatusNow(`PDF exported @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      setStatusNow('PDF export failed.', 'err');
    }
  }, [getPrintableContainer, setStatusNow, title]);

  const exportDOCX = useCallback(async () => {
    try {
      setStatusNow('Preparing DOCX…', 'neutral');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.js', () => (window as any).htmlDocx);
      const htmlBody = getEditorHtml();
      const docHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
      downloadBlob((window as any).htmlDocx.asBlob(docHtml), safeFilename(title, 'docx'));
      setStatusNow(`DOCX exported @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      setStatusNow('DOCX export failed.', 'err');
    }
  }, [getEditorHtml, setStatusNow, title]);

  const exportODT = useCallback(async () => {
    try {
      setStatusNow('Preparing ODT…', 'neutral');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', () => (window as any).JSZip);
      const text = getEditorText();
      const paras = text.split('\n').map(t => t.trim()).filter(Boolean);
      const escapeXml = (s: string) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      const contentXml = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">\n <office:body><office:text>\n  ${paras.map(p => `<text:p>${escapeXml(p)}</text:p>`).join('\n  ')}\n </office:text></office:body>\n</office:document-content>`;

      const stylesXml = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.2"><office:styles/></office:document-styles>`;

      const metaXml = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2">\n <office:meta><meta:generator>Apollo Documents</meta:generator></office:meta>\n</office:document-meta>`;

      const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>\n<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">\n <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>\n <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>\n <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>\n <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>\n</manifest:manifest>`;

      const zip = new (window as any).JSZip();
      zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
      zip.file('content.xml', contentXml);
      zip.file('styles.xml', stylesXml);
      zip.file('meta.xml', metaXml);
      zip.folder('META-INF').file('manifest.xml', manifestXml);

      const blob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(blob, safeFilename(title, 'odt'));
      setStatusNow(`ODT exported @ ${fmtTime(Date.now())}`, 'ok');
    } catch {
      setStatusNow('ODT export failed.', 'err');
    }
  }, [getEditorText, setStatusNow, title]);

  const onPrint = useCallback(async () => {
    try {
      const contentHtml = getEditorHtml();

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
        body { margin: 0; font-family: "Inter", system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; }
        img{ max-width: 100% !important; height: auto !important; }
        a{ color: inherit; text-decoration: underline; }
        pre, code{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 10.5pt; }
        h1{ font-size: 20pt; margin: 0 0 10px; }
        h2{ font-size: 16pt; margin: 0 0 10px; }
        h3{ font-size: 13pt; margin: 0 0 10px; }
        p{ margin: 0 0 10px; }
        ul, ol{ margin: 0 0 10px 22px; }
      `;

      const html = `<!doctype html><html><head><meta charset="utf-8" />
        <title>Print</title>
        <style>${printCss}</style>
      </head><body>
        ${contentHtml}
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
  }, [getEditorHtml]);

  const statusAria = useMemo(() => status.text, [status.text]);

  // Toolbar state
  const headingValue = useMemo(() => {
    if (!editor) return '';
    if (editor.isActive('heading', { level: 1 })) return '1';
    if (editor.isActive('heading', { level: 2 })) return '2';
    if (editor.isActive('heading', { level: 3 })) return '3';
    return '';
  }, [editor, editor?.state]);

  const setHeading = useCallback((v: string) => {
    if (!editor) return;
    const lvl = Number(v);
    if (!lvl) editor.chain().focus().setParagraph().run();
    else editor.chain().focus().toggleHeading({ level: Math.max(1, Math.min(3, lvl)) as 1 | 2 | 3 }).run();
  }, [editor]);

  const setOrUnsetLink = useCallback(() => {
    if (!editor) return;
    try {
      const prev = editor.getAttributes('link')?.href as string | undefined;
      const url = window.prompt('Link URL', prev ?? '');
      if (url === null) return;
      const clean = url.trim();
      if (!clean) {
        editor.chain().focus().unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href: clean }).run();
    } catch {
      // ignore
    }
  }, [editor]);

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

                  <button className="menu-item" id="btnSave" type="button" onClick={() => persist('manual')}>
                    <div className="menu-item-title">Save</div>
                    <div className="menu-item-desc">Manual snapshot (Ctrl/Cmd+S)</div>
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
            <div aria-label="Editor toolbar" className="tt-toolbar" id="toolbar" role="toolbar">
              <span className="tt-group">
                <label className="sr-only" htmlFor="ttHeading">Heading</label>
                <select aria-label="Heading" id="ttHeading" value={headingValue} onChange={(e) => setHeading(e.target.value)} disabled={!editor}>
                  <option value="">Normal</option>
                  <option value="1">Heading 1</option>
                  <option value="2">Heading 2</option>
                  <option value="3">Heading 3</option>
                </select>
              </span>

              <span className="tt-group">
                <button type="button" className={`tt-btn${editor?.isActive('bold') ? ' is-active' : ''}`} aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} disabled={!editor}>B</button>
                <button type="button" className={`tt-btn${editor?.isActive('italic') ? ' is-active' : ''}`} aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} disabled={!editor}>I</button>
                <button type="button" className={`tt-btn${editor?.isActive('underline') ? ' is-active' : ''}`} aria-label="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()} disabled={!editor}>U</button>
                <button type="button" className={`tt-btn${editor?.isActive('strike') ? ' is-active' : ''}`} aria-label="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()} disabled={!editor}>S</button>
              </span>

              <span className="tt-group">
                <button type="button" className={`tt-btn${editor?.isActive('orderedList') ? ' is-active' : ''}`} aria-label="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()} disabled={!editor}>1.</button>
                <button type="button" className={`tt-btn${editor?.isActive('bulletList') ? ' is-active' : ''}`} aria-label="Bullet list" onClick={() => editor?.chain().focus().toggleBulletList().run()} disabled={!editor}>•</button>
                <button type="button" className={`tt-btn${editor?.isActive('blockquote') ? ' is-active' : ''}`} aria-label="Blockquote" onClick={() => editor?.chain().focus().toggleBlockquote().run()} disabled={!editor}>❝</button>
                <button type="button" className={`tt-btn${editor?.isActive('codeBlock') ? ' is-active' : ''}`} aria-label="Code block" onClick={() => editor?.chain().focus().toggleCodeBlock().run()} disabled={!editor}>⌘</button>
              </span>

              <span className="tt-group">
                <button type="button" className={`tt-btn${editor?.isActive('link') ? ' is-active' : ''}`} aria-label="Insert link" onClick={setOrUnsetLink} disabled={!editor}>Link</button>
                <button type="button" className="tt-btn" aria-label="Clear formatting" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} disabled={!editor}>Clear</button>
              </span>
            </div>

            <div className="wordcount" hidden={!wordCountEnabled} id="wordCount">Words: {wordCount}</div>
          </div>
        </div>

        <section className="panel">
          <EditorContent editor={editor} />
        </section>

        <ToastHost toastRef={toast.refs.toastRef} textRef={toast.refs.textRef} timerRef={toast.refs.timerRef} variant="danger" />
      </main>

      <SiteFooter />
    </>
  );
}
