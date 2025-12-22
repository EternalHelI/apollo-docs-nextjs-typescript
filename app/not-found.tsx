import Link from 'next/link';

import { Brand } from '@/components/Brand';
import { SiteFooter } from '@/components/SiteFooter';

export default function NotFound() {
  return (
    <main>
      <header className="app-header">
        <div className="container app-header-inner">
          <Brand />
        </div>
      </header>

      <section className="container" style={{ padding: '44px 0 26px' }}>
        <h1 style={{ fontSize: 28, margin: '0 0 10px' }}>Page not found</h1>
        <p style={{ margin: '0 0 18px', color: 'var(--muted)' }}>
          The page you requested does not exist. Use the link below to return to Apollo Documents.
        </p>
        <Link className="btn" href="/homepage">Go to Homepage</Link>
      </section>

      <SiteFooter />
    </main>
  );
}
