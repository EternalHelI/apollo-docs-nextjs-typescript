export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeText(s: unknown): string {
  return escapeHtml((s || '').toString());
}

export function fmtTime(ms: number): string {
  try {
    const d = new Date(ms);
    return d.toLocaleString([], { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function generateId(): string {
  // Prefer UUIDs when available, but return a historical 32-hex format.
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof (c as any).randomUUID === 'function') {
      return (c as any).randomUUID().replace(/-/g, '');
    }
  } catch {
    // ignore
  }

  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      c.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // ignore
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`;
}

export function safeFilename(name: string, ext: string): string {
  const base = (name || 'Apollo Document')
    .trim()
    .replace(/[\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || 'Apollo Document';

  const suffix = (ext || '').startsWith('.') ? ext : `.${ext || ''}`;
  return `${base}${suffix}`;
}

export function downloadBlob(blob: Blob, filename: string, opts?: { revokeDelayMs?: number }): void {
  const revokeDelayMs = Math.max(0, Number(opts?.revokeDelayMs ?? 1000) || 0);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Safari can cancel downloads if we revoke immediately.
  window.setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
  }, revokeDelayMs);
}

export function prefersReducedMotion(): boolean {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export function prefersLightTheme(): boolean {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  } catch {
    return false;
  }
}
