import { APP_NAME, APP_VERSION } from '@/lib/version';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span aria-hidden="true" className="footer-dot" />
          <span>{APP_NAME}</span>
        </div>
        <div aria-label="Site version" className="footer-meta">
          <span className="footer-pill">v{APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
}
