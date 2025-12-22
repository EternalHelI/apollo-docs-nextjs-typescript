import type { Metadata } from 'next';

import EditorClient from './EditorClient';

// This app is localStorage-first and client-heavy. Force dynamic rendering to avoid
// static prerender bailouts during CI builds when search params are involved.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Editor • Apollo Documents'
};

export default function EditorPage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = props.searchParams?.id;
  const initialId = Array.isArray(raw) ? raw[0] : raw;
  return <EditorClient initialId={initialId} />;
}
