import { prefersReducedMotion } from '@/lib/utils';

export function initPageLoader(): void {
  if (typeof document === 'undefined') return;
  try {
    if (prefersReducedMotion()) return;
  } catch {
    // ignore
  }

  try {
    const loader = document.createElement('div');
    loader.className = 'page-loader is-on';
    loader.setAttribute('aria-hidden', 'true');
    loader.innerHTML = '<div class="page-loader-inner"><div class="page-loader-spinner"></div></div>';
    document.body.appendChild(loader);

    window.setTimeout(() => {
      loader.classList.remove('is-on');
      loader.classList.add('is-off');
    }, 450);

    window.setTimeout(() => {
      try { loader.remove(); } catch {}
    }, 700);
  } catch {
    // ignore
  }
}
