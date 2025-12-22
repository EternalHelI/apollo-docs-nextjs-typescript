import type { Metadata } from 'next';
import Script from 'next/script';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Apollo Hub • Apollo Documents',
  description: 'Apollo Documents — manage your documents locally in your browser and open the editor when needed.',
  viewport: { width: 'device-width', initialScale: 1 },
  icons: { icon: '/assets/gear-16.png' },
  other: { 'color-scheme': 'dark light' }
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
        <Script id="theme-init" strategy="beforeInteractive">{`
          (() => {
            try {
              const t = localStorage.getItem('apollo_docs_theme_v1');
              if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
            } catch {}
          })();
        `}</Script>
      </head>
      <body>{props.children}</body>
    </html>
  );
}
