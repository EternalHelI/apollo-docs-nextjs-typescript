'use client';

import { useEffect } from 'react';
import { initPageLoader } from '@/lib/ui/pageLoader';

export function usePageLoader() {
  useEffect(() => {
    initPageLoader();
  }, []);
}
