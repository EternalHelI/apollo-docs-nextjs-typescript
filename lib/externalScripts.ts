export function loadScriptOnce(url: string, test: () => unknown): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  try {
    if (test()) return Promise.resolve();
  } catch {
    // ignore
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-apollo-src="${url}"]`) as HTMLScriptElement | null;
    if (existing) {
      const done = () => resolve();
      const fail = () => reject(new Error(`Failed to load ${url}`));
      existing.addEventListener('load', done, { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const s = document.createElement('script');
    s.src = url;
    s.defer = true;
    s.dataset.apolloSrc = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(s);
  });
}
