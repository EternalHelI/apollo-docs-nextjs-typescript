'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocsViewMode } from '@/lib/types';
import { loadDocsView, storeDocsView } from '@/lib/storage';

export function useDocsViewMode() {
  const [view, setView] = useState<DocsViewMode>('grid');

  useEffect(() => {
    setView(loadDocsView());
  }, []);

  const set = useCallback((v: DocsViewMode) => {
    const next = v === 'list' ? 'list' : 'grid';
    setView(next);
    storeDocsView(next);
  }, []);

  const toggle = useCallback(() => {
    set(view === 'list' ? 'grid' : 'list');
  }, [view, set]);

  const label = useMemo(() => (view === 'list' ? 'Grid mode' : 'List mode'), [view]);

  return { view, setView: set, toggleView: toggle, toggleLabel: label, isList: view === 'list' };
}
