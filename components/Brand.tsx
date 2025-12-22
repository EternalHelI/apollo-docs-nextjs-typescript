import Link from 'next/link';

export function Brand(props: { href?: string; ariaLabel?: string }) {
  const href = props.href ?? '/homepage';
  const ariaLabel = props.ariaLabel ?? 'Apollo Hub — Apollo Documents home';
  return (
    <Link aria-label={ariaLabel} className="brand" href={href}>
      <span aria-hidden="true" className="brand-badge">
        <svg viewBox="0 0 24 24">
          <path d="M12 2c3.9 2.2 6.4 6.3 6.4 10.8 0 3.7-1.7 7.1-4.4 9.2l-1.3-3c1.6-1.3 2.6-3.3 2.6-5.5 0-3.2-2.1-6.2-3.3-7.7-.4.5-.9 1.2-1.4 2.1l-1.8-.9C10.1 4.7 11.2 3.1 12 2zm-5.2 9.1c.6 2.3 2.4 4.1 4.7 4.7-.6 2.3-2.4 4.1-4.7 4.7-.6-2.3-2.4-4.1-4.7-4.7.6-2.3 2.4-4.1 4.7-4.7z"></path>
        </svg>
      </span>
      <span className="brand-text">
        <span className="brand-title">Apollo Hub</span>
        <span className="brand-sub">Apollo Documents</span>
      </span>
    </Link>
  );
}
