'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ToastController } from '@/lib/ui/toast';
import { createToast } from '@/lib/ui/toast';

export function useToast() {
  const toastRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLDivElement>(null);

  const controllerRef = useRef<ToastController | null>(null);

  useEffect(() => {
    controllerRef.current = createToast({ toastEl: toastRef.current, textEl: textRef.current, timerEl: timerRef.current });
    return () => {
      controllerRef.current?.hide();
      controllerRef.current = null;
    };
  }, []);

  const api = useMemo(() => {
    return {
      refs: { toastRef, textRef, timerRef },
      show: (htmlMessage: string, seconds?: number) => controllerRef.current?.show(htmlMessage, seconds),
      hide: () => controllerRef.current?.hide()
    };
  }, []);

  return api;
}
