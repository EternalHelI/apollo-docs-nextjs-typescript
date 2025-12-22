export type ThemeMode = 'dark' | 'light';
export type DocsViewMode = 'grid' | 'list';
export type ChangelogViewMode = 'grid' | 'list';

export interface DocMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface TrashItem {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
  /** Stored as the raw JSON string of a Quill Delta for maximum backward-compatibility. */
  delta: string | null;
}

export interface ChangelogSection {
  title: string;
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g., 6:52 PM PST
  title: string;
  summary: string;
  sections: ChangelogSection[];
}
