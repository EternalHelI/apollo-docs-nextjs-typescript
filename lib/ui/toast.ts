export interface ToastController {
  show: (htmlMessage: string, seconds?: number) => void;
  hide: () => void;
}

export function createToast(opts: {
  toastEl: HTMLElement | null;
  textEl: HTMLElement | null;
  timerEl: HTMLElement | null;
}): ToastController {
  const toastEl = opts.toastEl;
  const textEl = opts.textEl;
  const timerEl = opts.timerEl;

  let hideTimeout: number | null = null;
  let tickTimeout: number | null = null;
  let remaining = 0;

  const clearTimers = () => {
    if (hideTimeout) window.clearTimeout(hideTimeout);
    if (tickTimeout) window.clearTimeout(tickTimeout);
    hideTimeout = null;
    tickTimeout = null;
  };

  const setTimerText = () => {
    if (!timerEl) return;
    timerEl.textContent = `${Math.max(0, remaining)}s`;
  };

  const scheduleTick = () => {
    if (!timerEl) return;
    tickTimeout = window.setTimeout(() => {
      remaining = Math.max(0, remaining - 1);
      setTimerText();
      if (remaining > 0) scheduleTick();
    }, 1000);
  };

  const hide = () => {
    clearTimers();
    if (!toastEl) return;
    toastEl.classList.remove('is-open');
    toastEl.classList.add('is-closing');
    window.setTimeout(() => {
      toastEl.hidden = true;
      toastEl.classList.remove('is-closing');
      if (textEl) textEl.textContent = '';
    }, 200);
  };

  const show = (htmlMessage: string, seconds = 5) => {
    if (!toastEl || !textEl) return;
    clearTimers();

    // Accept pre-sanitized HTML.
    textEl.innerHTML = htmlMessage;

    remaining = Math.max(1, Math.min(30, Math.floor(seconds)));
    setTimerText();

    toastEl.hidden = false;
    toastEl.classList.remove('is-closing');
    window.requestAnimationFrame(() => toastEl.classList.add('is-open'));

    scheduleTick();
    hideTimeout = window.setTimeout(hide, remaining * 1000);
  };

  return { show, hide };
}
