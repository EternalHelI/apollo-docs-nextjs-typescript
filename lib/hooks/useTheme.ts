'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ThemeMode } from '@/lib/types';
import { loadTheme, storeTheme } from '@/lib/storage';
import { prefersLightTheme } from '@/lib/utils';

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const t = loadTheme(prefersLightTheme());
    setTheme(t);
    try { document.documentElement.dataset.theme = t; } catch {}
  }, []);

  const set = useCallback((t: ThemeMode) => {
    setTheme(t);
    try { document.documentElement.dataset.theme = t; } catch {}
    storeTheme(t);
  }, []);

  const toggle = useCallback(() => {
    set(theme === 'dark' ? 'light' : 'dark');
  }, [theme, set]);

  const label = useMemo(() => (theme === 'dark' ? 'Light mode' : 'Dark mode'), [theme]);

  return { theme, setTheme: set, toggleTheme: toggle, toggleLabel: label, isDark: theme === 'dark' };
}
