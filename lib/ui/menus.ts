type MenuType = 'settings' | 'info' | string;

interface MenuHandle {
  type: MenuType;
  trigger: HTMLElement;
  panel: HTMLElement;
  items: HTMLElement[];
}

function isElement(x: unknown): x is Element {
  return !!x && typeof x === 'object' && (x as Element).nodeType === 1;
}

function collapseNestedSubpanels(panel: HTMLElement): void {
  try {
    const subs = Array.from(panel.querySelectorAll<HTMLElement>('.menu-subpanel'));
    subs.forEach(sp => {
      if (sp.hidden) {
        sp.classList.remove('open', 'closing');
        return;
      }

      sp.classList.remove('open');
      sp.classList.add('closing');
      window.setTimeout(() => {
        try {
          sp.hidden = true;
          sp.classList.remove('closing');
        } catch {
          // ignore
        }
      }, 160);
    });

    Array.from(panel.querySelectorAll<HTMLElement>('button[aria-controls]')).forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  } catch {
    // ignore
  }
}

export function initMenus(root: ParentNode = document): () => void {
  if (typeof document === 'undefined') return () => {};

  const abort = new AbortController();
  const on = <K extends keyof DocumentEventMap>(
    target: Document | HTMLElement,
    type: K,
    handler: (ev: DocumentEventMap[K]) => void,
    opts?: AddEventListenerOptions
  ) => {
    target.addEventListener(type, handler as any, { ...opts, signal: abort.signal });
  };

  const menus: MenuHandle[] = Array.from(root.querySelectorAll<HTMLElement>('.menu'))
    .map((menuEl) => {
      const trigger = menuEl.querySelector<HTMLElement>('.menu-trigger');
      const panel = menuEl.querySelector<HTMLElement>('.menu-panel');
      if (!trigger || !panel) return null;

      panel.hidden = true;
      panel.classList.remove('open', 'closing');
      trigger.setAttribute('aria-expanded', 'false');

      const items = Array.from(panel.querySelectorAll<HTMLElement>('button.menu-item, a.menu-item'));
      const type = (menuEl.getAttribute('data-menu') || '') as MenuType;
      return { type, trigger, panel, items };
    })
    .filter((x): x is MenuHandle => !!x);

  const closeMenu = (m: MenuHandle, restoreFocus = false, animate = true) => {
    if (m.type === 'settings') collapseNestedSubpanels(m.panel);

    if (m.panel.hidden) {
      m.panel.classList.remove('open', 'closing');
      m.trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) {
        try { m.trigger.focus(); } catch {}
      }
      return;
    }

    m.panel.classList.remove('open');
    m.panel.classList.add('closing');
    m.trigger.setAttribute('aria-expanded', 'false');

    if (restoreFocus) {
      try { m.trigger.focus(); } catch {}
    }

    if (!animate) {
      m.panel.hidden = true;
      m.panel.classList.remove('closing');
      return;
    }

    window.setTimeout(() => {
      m.panel.hidden = true;
      m.panel.classList.remove('closing');

      if (m.type === 'settings') {
        try {
          const subs = Array.from(m.panel.querySelectorAll<HTMLElement>('.menu-subpanel'));
          subs.forEach(sp => {
            sp.hidden = true;
            sp.classList.remove('open', 'closing');
          });
        } catch {
          // ignore
        }
      }
    }, 160);
  };

  const closeAll = (except?: MenuHandle) => menus.forEach(m => { if (except && m === except) return; closeMenu(m); });

  const openMenu = (m: MenuHandle, focusFirst = true) => {
    closeAll(m);
    m.panel.hidden = false;
    m.panel.classList.remove('closing');
    window.requestAnimationFrame(() => m.panel.classList.add('open'));
    m.trigger.setAttribute('aria-expanded', 'true');
    if (focusFirst && m.items.length) {
      try { m.items[0].focus(); } catch {}
    }
  };

  const toggleMenu = (m: MenuHandle) => (!m.panel.hidden ? closeMenu(m, true) : openMenu(m, true));

  const focusItem = (m: MenuHandle, idx: number) => {
    if (!m.items.length) return;
    const i = Math.max(0, Math.min(idx, m.items.length - 1));
    try { m.items[i].focus(); } catch {}
  };

  menus.forEach((m) => {
    on(m.trigger, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(m);
    });

    on(m.trigger, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu(m, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(m, true);
      }
    });

    // Close on item click except Settings.
    on(m.panel, 'click', (e: MouseEvent) => {
      const t = e.target;
      if (!isElement(t)) return;
      const btn = (t.closest('button.menu-item') || t.closest('a.menu-item')) as HTMLElement | null;
      if (!btn) return;
      if (m.type !== 'settings') closeAll();
    });

    on(m.panel, 'keydown', (e: KeyboardEvent) => {
      const activeIndex = m.items.findIndex(b => b === document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(m, true); return; }
      if (e.key === 'Tab') { closeAll(); return; }
      if (!m.items.length) return;

      if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(m, (activeIndex + 1) % m.items.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(m, (activeIndex - 1 + m.items.length) % m.items.length); }
      else if (e.key === 'Home') { e.preventDefault(); focusItem(m, 0); }
      else if (e.key === 'End') { e.preventDefault(); focusItem(m, m.items.length - 1); }
    });
  });

  on(document, 'click', (e: MouseEvent) => {
    const t = e.target;
    if (isElement(t) && t.closest('.menu')) return;
    closeAll();
  });

  on(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeAll();
  });

  return () => abort.abort();
}
