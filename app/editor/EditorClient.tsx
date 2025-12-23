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
import { DEFAULT_DOC_CONTENT_V2_RAW, createDoc, ensureDocMeta, setDocTitle, touchDoc } from '@/lib/docsStore';
import { getIntroSeedKeyV1, loadContentV2Raw, loadWordCountEnabled, saveContentV2Raw, storeWordCountEnabled } from '@/lib/storage';
import { downloadBlob, escapeHtml, safeFilename } from '@/lib/utils';
import { loadScriptOnce } from '@/lib/externalScripts';

type StatusTone = 'neutral' | 'ok' | 'warn' | 'err';
type StatusMode = 'loading' | 'ready' | 'autosaving' | 'saving' | 'working' | 'saved' | 'message' | 'error';

interface StatusState {
  mode: StatusMode;
  tone: StatusTone;
  base: string;
  at?: number;
}

function statusClass(tone: StatusTone): string {
  switch (tone) {
    case 'ok': return 'status status--ok';
    case 'warn': return 'status status--warn';
    case 'err': return 'status status--err';
    default: return 'status';
  }
}

function fmtClock(ms: number): string {
  try {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function textToBasicHtml(text: string): string {
  const clean = (text || '').replace(/\r\n?/g, '\n').trim();
  if (!clean) return '<p></p>';
  const paras = clean.split(/\n{2,}/g).map(p => p.trim()).filter(Boolean);
  const toP = (p: string) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`;
  return paras.map(toP).join('');
}

// TipTap/ProseMirror empty documents typically look like:
// { type:'doc', content:[{ type:'paragraph' }] } (or with an empty text node).
function isEffectivelyEmptyDoc(json: any): boolean {
  try {
    const c = json?.content;
    if (!Array.isArray(c)) return true;
    if (c.length === 0) return true;
    if (c.length === 1 && c[0]?.type === 'paragraph') {
      const pc = c[0]?.content;
      if (!Array.isArray(pc) || pc.length === 0) return true;
      if (pc.length === 1 && pc[0]?.type === 'text' && String(pc[0]?.text ?? '').trim() === '') return true;
    }
    return false;
  } catch {
    return true;
  }
}

// Intro content for brand-new documents.
// We intentionally use insertContent (nodes array) to match TipTap docs and to avoid
// edge cases where setContent can be overridden by early autosave flows.
const INTRO_INSERT_NODES = [
  {
    type: 'heading',
    attrs: { level: 1 },
    content: [{ type: 'text', text: 'Welcome to Apollo Documents' }]
  },
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'This is a new document. Start typing below — Apollo will autosave as you work.' }]
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
] as const;

export default function EditorClient(props: { initialId?: string }) {
  usePageLoader();
  useMenus();
  usePrivateModeWarning();

  const router = useRouter();
  const requestedId = (typeof props.initialId === 'string' && props.initialId.trim()) ? props.initialId : null;

  const { isDark, toggleTheme, toggleLabel: themeLabel } = useThemeMode();
  const toast = useToast();

  const autosaveTimerRef = useRef<number | null>(null);
  const hydratedForDocRef = useRef<{ docId: string; editor: unknown } | null>(null);
  const hydratingRef = useRef(false);
  const userStartedRef = useRef(false);

  const getUserStartedKeyV1 = useCallback((docId: string) => {
    return `apollo_docs_doc_${docId}_has_user_content_v1`;
  }, []);

  const [doc, setDoc] = useState<DocMeta | null>(null);
  const [title, setTitle] = useState('Apollo Document');
  const [status, setStatus] = useState<StatusState>({ mode: 'loading', tone: 'neutral', base: 'Loading' });
  const [dots, setDots] = useState(0);
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

  // Dots animation for working/saving states.
  useEffect(() => {
    const needsDots = status.mode === 'loading' || status.mode === 'autosaving' || status.mode === 'saving' || status.mode === 'working';
    if (!needsDots) {
      setDots(0);
      return;
    }

    setDots(1);
    const id = window.setInterval(() => {
      setDots((d) => (d >= 3 ? 1 : d + 1));
    }, 320);

    return () => window.clearInterval(id);
  }, [status.mode, status.base]);

  const statusText = useMemo(() => {
    if (status.mode === 'saved') return `Saved @ ${fmtClock(status.at ?? Date.now())}`;
    if (status.mode === 'ready') return 'Ready.';
    if (status.mode === 'message' || status.mode === 'error') return status.base;
    return `${status.base}${dots ? '.'.repeat(dots) : ''}`;
  }, [dots, status]);

  const setReady = useCallback(() => setStatus({ mode: 'ready', tone: 'neutral', base: 'Ready' }), []);
  const setWorking = useCallback((base: string, tone: StatusTone = 'neutral') => setStatus({ mode: 'working', tone, base }), []);
  const setAutosaving = useCallback(() => {
    setStatus((s) => {
      if (s.mode === 'loading' || s.mode === 'working' || s.mode === 'saving') return s;
      if (s.mode === 'autosaving') return s;
      return { mode: 'autosaving', tone: 'neutral', base: 'Autosaving' };
    });
  }, []);
  const setSaving = useCallback(() => setStatus({ mode: 'saving', tone: 'neutral', base: 'Saving' }), []);
  const setSaved = useCallback((at = Date.now()) => setStatus({ mode: 'saved', tone: 'ok', base: 'Saved', at }), []);
  const setMessage = useCallback((base: string, tone: StatusTone = 'neutral') => setStatus({ mode: 'message', tone, base }), []);
  const setError = useCallback((base: string) => setStatus({ mode: 'error', tone: 'err', base }), []);

  // Resolve doc meta.
  useEffect(() => {
    if (!requestedId) return;
    const meta = ensureDocMeta(requestedId);
    setDoc(meta);
    setTitle(meta.title || 'Apollo Document');
  }, [requestedId]);

  // If no id was provided, create a new doc and push.
  useEffect(() => {
    if (requestedId) return;
    try {
      const meta = createDoc('Apollo Document');
      // Don't rely on a navigation refresh to hydrate state; set local state immediately.
      setDoc(meta);
      setTitle(meta.title || 'Apollo Document');
      router.replace(`/editor?id=${encodeURIComponent(meta.id)}`);
    } catch {
      router.replace('/homepage');
    }
  }, [requestedId, router]);

  // Word count preference.
  useEffect(() => {
    setWordCountEnabled(loadWordCountEnabled());
  }, []);

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

  const persistAuto = useCallback(() => {
    if (!doc || !editor) return;
    try {
      const json = editor.getJSON();
      saveContentV2Raw(doc.id, JSON.stringify(json));
      try { touchDoc(doc.id); } catch {}
      setSaved(Date.now());
    } catch {
      setError("Couldn't autosave");
    }
  }, [doc, editor, setError, setSaved]);

  const persistManual = useCallback(() => {
    if (!doc || !editor) return;
    try {
      setSaving();
      const json = editor.getJSON();
      saveContentV2Raw(doc.id, JSON.stringify(json));
      try { touchDoc(doc.id); } catch {}
      setSaved(Date.now());
    } catch {
      setError("Couldn't save");
    }
  }, [doc, editor, setError, setSaved, setSaving]);

  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      persistAuto();
    }, 850);
  }, [persistAuto]);

  // Load content for this doc.
  useEffect(() => {
    if (!doc || !editor) return;
    if (hydratedForDocRef.current?.docId === doc.id && hydratedForDocRef.current.editor === editor) return;
    hydratedForDocRef.current = { docId: doc.id, editor };

    const run = () => {
      try {
        setWorking('Loading');
        hydratingRef.current = true;

        // Read the "user started" flag once for this doc. If the user has ever
        // typed meaningful content, we should not auto-inject the intro again
        // even if they later clear the document.
        try {
          userStartedRef.current = window.localStorage.getItem(getUserStartedKeyV1(doc.id)) === '1';
        } catch {
          userStartedRef.current = false;
        }

        const rawV2 = loadContentV2Raw(doc.id);
        // Load persisted TipTap JSON. If corrupted/unparseable, fall back to the default
        // template instead of leaving the editor empty.
        let loaded: any = null;
        if (rawV2) {
          try {
            loaded = JSON.parse(rawV2);
          } catch {
            loaded = null;
          }
        }

        if (loaded) {
          editor.commands.setContent(loaded);
        } else {
          // No snapshot yet (or invalid snapshot): seed with the intro template.
          editor.commands.setContent(JSON.parse(DEFAULT_DOC_CONTENT_V2_RAW));
          try {
            saveContentV2Raw(doc.id, DEFAULT_DOC_CONTENT_V2_RAW);
            try { touchDoc(doc.id); } catch {}
          } catch {
            // ignore (private mode / storage disabled)
          }
        }

        // Ensure documents that are still effectively empty display a welcome message.
        // We intentionally *do not* gate this on the older "intro seeded" flag because
        // earlier builds could set that flag even when no intro was inserted.
        try {
          const current = editor.getJSON();
          const hasUserContent = userStartedRef.current;

          if (!hasUserContent && isEffectivelyEmptyDoc(current)) {
            try { editor.commands.clearContent(true); } catch {}
            editor.commands.insertContent(INTRO_INSERT_NODES as any);

            // Persist immediately so refresh/back-forward doesn't drop the intro.
            try {
              saveContentV2Raw(doc.id, JSON.stringify(editor.getJSON()));
              try { touchDoc(doc.id); } catch {}
            } catch {
              // ignore
            }

            // Record that we've inserted the intro at least once.
            try { window.localStorage.setItem(getIntroSeedKeyV1(doc.id), '1'); } catch {}
          }
        } catch {
          // ignore
        }

        setReady();
        computeWordCount();
      } catch {
        setError('Editor failed to load');
      } finally {
        // Avoid treating the initial setContent as a user edit.
        // TipTap can fire multiple update events during content hydration.
        window.setTimeout(() => { hydratingRef.current = false; }, 180);
      }
    };

    run();
  }, [computeWordCount, doc, editor, getUserStartedKeyV1, setError, setReady, setWorking]);

  // Safety net: if anything interrupts the initial hydration, avoid leaving the
  // status pill stuck on "Loading...".
  useEffect(() => {
    if (!doc || !editor) return;
    const t = window.setTimeout(() => {
      setStatus((s) => {
        if (s.mode === 'loading' || s.mode === 'working') {
          return { mode: 'ready', tone: 'neutral', base: 'Ready' };
        }
        return s;
      });
    }, 2200);
    return () => window.clearTimeout(t);
  }, [doc, editor]);

  // Autosave on user edits
  useEffect(() => {
    if (!editor) return;

    const handler = () => {
      // Ignore editor changes caused by hydration (setContent / insertContent).
      if (hydratingRef.current) return;

      // First real user edit: record a durable marker so we don't ever
      // auto-inject the intro for this document again.
      if (doc && !userStartedRef.current) {
        userStartedRef.current = true;
        try { window.localStorage.setItem(getUserStartedKeyV1(doc.id), '1'); } catch {}
      }

      if (wordCountEnabled) {
        const idle = (window as any).requestIdleCallback as ((cb: () => void) => void) | undefined;
        if (typeof idle === 'function') idle(() => computeWordCount()); else computeWordCount();
      }

      setAutosaving();
      scheduleAutosave();
    };

    editor.on('update', handler);
    return () => {
      try { editor.off('update', handler); } catch {}
    };
  }, [computeWordCount, doc, editor, getUserStartedKeyV1, scheduleAutosave, setAutosaving, wordCountEnabled]);

  // Ctrl/Cmd+S manual save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 's') {
        e.preventDefault();
        persistManual();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persistManual]);

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
      setMessage(`Saved JSON @ ${fmtClock(Date.now())}`, 'ok');
    } catch {
      setError('Save As failed');
    }
  }, [doc, editor, getEditorHtml, getEditorText, setError, setMessage, title]);

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
      setWorking('Preparing PDF');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js', () => (window as any).html2pdf);

      setMessage('Exporting PDF…', 'warn');
      const filename = safeFilename(title, 'pdf');
      await (window as any).html2pdf().set({
        margin: 10,
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(getPrintableContainer()).save();

      setMessage(`PDF exported @ ${fmtClock(Date.now())}`, 'ok');
    } catch {
      setError('PDF export failed');
    }
  }, [getPrintableContainer, setError, setMessage, setWorking, title]);

  const exportDOCX = useCallback(async () => {
    try {
      setWorking('Preparing DOCX');
      await loadScriptOnce('https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.js', () => (window as any).htmlDocx);

      const htmlBody = getEditorHtml();
      const docHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body>${htmlBody}</body></html>`;
      downloadBlob((window as any).htmlDocx.asBlob(docHtml), safeFilename(title, 'docx'));
      setMessage(`DOCX exported @ ${fmtClock(Date.now())}`, 'ok');
    } catch {
      setError('DOCX export failed');
    }
  }, [getEditorHtml, setError, setMessage, setWorking, title]);

  const exportODT = useCallback(async () => {
    try {
      setWorking('Preparing ODT');
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
      setMessage(`ODT exported @ ${fmtClock(Date.now())}`, 'ok');
    } catch {
      setError('ODT export failed');
    }
  }, [getEditorText, setError, setMessage, setWorking, title]);

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

      <main className="editor-wrap" id="main">
        <div className="docbar docbar--nav" id="docbar">
          <div className="docbar-surface">
            <div className="docbar-inner docbar-inner--editor">
            <div className="docbar-left">
              <span aria-hidden="true" className="docbar-kicker">Document Name</span>
              <label className="sr-only" htmlFor="docTitle">Document Name</label>
              <input
                autoComplete="off"
                id="docTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={onTitleBlur}
              />
              <div aria-live="polite" className={statusClass(status.tone)} id="status" role="status">{statusText}</div>
              <div className="wordcount-pill" hidden={!wordCountEnabled}>Words: {wordCount}</div>
            </div>

            <div className="docbar-mid" aria-label="Document settings">
              <div aria-label="Editor toolbar" className="tt-toolbar tt-toolbar--inline" id="toolbar" role="toolbar">
                <span className="tt-group">
                  <span aria-hidden="true" className="docbar-kicker">Heading</span>
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
            </div>

            <nav aria-label="Document actions" className="docbar-actions">
              <button aria-label="Print" className="btn btn-print" id="btnPrint" title="Print document" type="button" onClick={() => void onPrint()}>
                <img alt="" aria-hidden="true" className="icon-print-img" height={16} src="/assets/print-svgrepo-com.svg" width={16} />
                <span className="btn-text">Print</span>
              </button>

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

                  <button className="menu-item" id="btnSave" type="button" onClick={persistManual}>
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
            </nav>
            </div>
          </div>
        </div>

        <div className="container editor-body">
          <section className="panel panel--editor">
            <EditorContent editor={editor} />
          </section>

          <ToastHost toastRef={toast.refs.toastRef} textRef={toast.refs.textRef} timerRef={toast.refs.timerRef} variant="danger" />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
