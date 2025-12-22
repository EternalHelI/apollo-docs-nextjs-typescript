import { dismissPrivateWarn, privateWarnDismissed } from '@/lib/storage';

const PRIVATE_WARN_SESSION_KEY = 'apollo_docs_private_warned_session_v1';

async function detectPrivateContext(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // If user opted out, never show again.
  if (privateWarnDismissed()) return false;

  // Safari private mode / blocked storage can throw on localStorage writes.
  try {
    window.localStorage.setItem('__apollo_ls_test__', '1');
    window.localStorage.removeItem('__apollo_ls_test__');
  } catch {
    return true;
  }

  const idbOk = await new Promise<boolean>((resolve) => {
    if (!('indexedDB' in window)) return resolve(false);

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open('__apollo_pm_idb_test__', 1);
    } catch {
      return resolve(false);
    }

    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try { req.result?.close(); } catch {}
      try { indexedDB.deleteDatabase('__apollo_pm_idb_test__'); } catch {}
      resolve(ok);
    };

    req.onerror = () => finish(false);
    req.onsuccess = () => finish(true);
    req.onupgradeneeded = () => {};

    window.setTimeout(() => finish(false), 800);
  });

  if (!idbOk) return true;

  // Conservative quota heuristic.
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      const quota = est?.quota;
      if (typeof quota === 'number' && quota > 0 && quota < (120 * 1024 * 1024)) return true;
    }
  } catch {
    // ignore
  }

  return false;
}

function buildModal(): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'privateModeBackdrop';
  backdrop.hidden = true;

  backdrop.innerHTML = `
    <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="privateModeTitle" aria-describedby="privateModeDesc">
      <div class="modal-header">
        <div class="modal-title" id="privateModeTitle">Private / Incognito mode detected</div>
        <button class="icon-btn" type="button" aria-label="Close dialog" id="privateModeClose">×</button>
      </div>
      <div class="modal-body">
        <p class="modal-text" id="privateModeDesc">
          Apollo Documents saves your work to <strong>local browser storage</strong>. In private browsing or restricted environments, storage may be unavailable or cleared automatically.
          <span class="modal-sub">If you want to keep documents, use a normal window and avoid clearing site data.</span>
        </p>
      </div>
      <div class="modal-actions">
        <button class="btn" type="button" id="privateModeDontShow">Don’t show again</button>
        <button class="btn btn-primary" type="button" id="privateModeOk">OK</button>
      </div>
    </div>
  `;

  const close = () => {
    backdrop.classList.remove('is-open');
    backdrop.classList.add('is-closing');
    window.setTimeout(() => {
      backdrop.hidden = true;
      backdrop.classList.remove('is-closing');
    }, 200);
  };

  const open = () => {
    backdrop.hidden = false;
    void backdrop.offsetWidth;
    window.requestAnimationFrame(() => backdrop.classList.add('is-open'));
    window.setTimeout(() => {
      try { (backdrop.querySelector('#privateModeOk') as HTMLElement | null)?.focus(); } catch {}
    }, 0);
  };

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('#privateModeClose')?.addEventListener('click', close);
  backdrop.querySelector('#privateModeOk')?.addEventListener('click', close);
  backdrop.querySelector('#privateModeDontShow')?.addEventListener('click', () => {
    dismissPrivateWarn();
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.hidden) close();
  });

  (backdrop as any).__apolloOpen = open;
  return backdrop;
}

function ensureModal(): HTMLElement {
  const existing = document.getElementById('privateModeBackdrop');
  if (existing) return existing;
  const modal = buildModal();
  document.body.appendChild(modal);
  return modal;
}

export async function maybeWarnPrivateMode(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Once per session.
  try {
    if (window.sessionStorage.getItem(PRIVATE_WARN_SESSION_KEY) === '1') return;
    window.sessionStorage.setItem(PRIVATE_WARN_SESSION_KEY, '1');
  } catch {
    // ignore
  }

  const isPrivate = await detectPrivateContext();
  if (!isPrivate) return;

  const backdrop = ensureModal();
  const open = (backdrop as any).__apolloOpen as (() => void) | undefined;
  open?.();
}
