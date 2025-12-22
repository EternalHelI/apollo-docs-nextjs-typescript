'use client';

import { useEffect } from 'react';
import { maybeWarnPrivateMode } from '@/lib/ui/privateMode';

export function usePrivateModeWarning() {
  useEffect(() => {
    void maybeWarnPrivateMode();
  }, []);
}
