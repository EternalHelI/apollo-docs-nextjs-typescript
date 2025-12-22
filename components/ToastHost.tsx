import type { RefObject } from 'react';

export function ToastHost(props: {
  toastRef: RefObject<HTMLDivElement>;
  textRef: RefObject<HTMLDivElement>;
  timerRef: RefObject<HTMLDivElement>;
  variant?: 'danger' | 'neutral';
}) {
  const variantClass = props.variant === 'neutral' ? 'toast' : 'toast toast-danger';
  return (
    <div aria-atomic="true" aria-live="polite" className={variantClass} hidden ref={props.toastRef} role="status">
      <div className="toast-inner">
        <div className="toast-text" ref={props.textRef} />
        <div className="toast-timer" ref={props.timerRef}>5s</div>
      </div>
    </div>
  );
}
