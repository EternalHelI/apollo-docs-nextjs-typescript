'use client';

import { useEffect } from 'react';
import { initMenus } from '@/lib/ui/menus';

export function useMenus() {
  useEffect(() => {
    const cleanup = initMenus(document);
    return () => cleanup();
  }, []);
}
