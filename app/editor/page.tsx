import type { Metadata } from 'next';

import EditorClient from './EditorClient';

export const metadata: Metadata = {
  title: 'Editor • Apollo Documents'
};

export default function EditorPage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = props.searchParams?.id;
  const initialId = Array.isArray(raw) ? raw[0] : raw;
  return <EditorClient initialId={initialId} />;
}
