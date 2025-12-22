'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangelogViewMode } from '@/lib/types';
import { loadChangelogView, storeChangelogView } from '@/lib/storage';

export function useChangelogViewMode() {
  const [view, setView] = useState<ChangelogViewMode>('list');

  useEffect(() => {
    setView(loadChangelogView());
  }, []);

  const set = useCallback((v: ChangelogViewMode) => {
    const next = v === 'grid' ? 'grid' : 'list';
    setView(next);
    storeChangelogView(next);
  }, []);

  const toggle = useCallback(() => {
    set(view === 'list' ? 'grid' : 'list');
  }, [view, set]);

  const label = useMemo(() => (view === 'list' ? 'Grid mode' : 'List mode'), [view]);

  return { view, setView: set, toggleView: toggle, toggleLabel: label, isList: view === 'list' };
}
