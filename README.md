# Apollo Documents (Apollo Hub)

**This is a demo site created by ChatGPT 5.2 with Extended Thinking.**

Apollo Documents is a local-first, browser-based document list + editor. Documents and settings are stored in the browser via `localStorage` (no server required). This repository is the **TypeScript-first Next.js** migration of the prior static HTML/JS bundle.

## What's in this version

- **Next.js App Router** with routes:
  - `/homepage` — document list
  - `/archive` — Archive/Trash with 30-day retention
  - `/editor` — document editor (TipTap)
  - `/changelogs` — changelog timeline & modal detail
- **TypeScript** for all application logic (storage, menus, pages, and UI glue)
- Preserved localStorage keys and data model so existing documents remain available after migration
- Shared, typed utilities for:
  - localStorage safety wrappers
  - document index + archive operations
  - menu behavior and toast controller
  - private browsing detection + warning

> **Important:** This app is still local-only. It does not include authentication, server persistence, or user accounts.

## Quick start

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm, pnpm, or yarn

### Install & run

```bash
npm install
npm run dev
```

Then open:
- `http://localhost:3000/homepage`

### Build for production

```bash
npm run build
npm run start
```

## Deployment

### Vercel

1. Import the repository into Vercel
2. Framework preset: **Next.js**
3. Build command: `next build`
4. Output: default

No environment variables are required.

## Project structure

- `app/` — Next.js App Router pages and global styles
- `components/` — shared UI components (brand, footer, toast host)
- `lib/` — typed application logic (storage, document store, UI controllers)
- `public/` — static assets (icons, fonts)

## Data model

All content is stored in the browser.

- Document index: `apollo_docs_index_v1`
- Trash/Archive: `apollo_docs_trash_v1`
- Per-document content (legacy v1/v2): `apollo_docs_doc_<docId>_delta` (Quill Delta JSON as a raw string)
- Per-document content (v3+): `apollo_docs_doc_<docId>_content_v2` (TipTap JSON as a raw string)
- Preferences:
  - Theme: `apollo_docs_theme_v1`
  - Docs view: `apollo_docs_view_v1`
  - Changelog view: `apollo_docs_changelog_view_v1`
  - Word count: `apollo_docs_wordcount_v1`

## Troubleshooting

### I see “Editor failed to load”

- This build uses TipTap (bundled via npm), so there is no CDN requirement for the editor itself.
- If you still see a failure, check the browser console for errors and confirm the deployment includes installed dependencies.

### Private/Incognito mode warning

- Some browsers limit `localStorage` or `indexedDB` in private contexts.
- If you continue in private mode, you may lose changes when the session ends.

### My exports do not work

Export formats are loaded lazily from CDNs:
- PDF: `html2pdf.js`
- DOCX: `html-docx-js`
- ODT: `jszip`

If a CDN is blocked, the export will fail.

## Versioning & releases

- Semantic versioning: `Major.Minor.Bugfix`
- ZIP export naming convention: `apollo-website-x.x.x.zip`
- The current version is displayed in the footer on all pages.

## Changelog policy

- `lib/changelogsData.ts` is append-only.
- Do not delete existing entries; only add new ones.
- Each new entry includes a PST timestamp in 12-hour format (e.g., `7:15 PM PST`).

---

© Apollo Hub / Apollo Documents
